import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Types } from 'mongoose';
import { BidQueueJobDto, QueueJobResultDto } from '../dto/queue.dto';
import { QUEUE_NAMES, JOB_TYPES } from '../config/queue.config';
import { AuctionService } from '../services/auction.service';
import { AuctionNotificationService } from '../services/auction-notification.service';
import { WebSocketAuthService } from '../services/websocket-auth.service';

/**
 * Processor for handling bid queue jobs
 */
@Processor(QUEUE_NAMES.BID_PROCESSING)
export class BidProcessor {
  private readonly logger = new Logger(BidProcessor.name);

  constructor(
    private readonly auctionService: AuctionService,
    private readonly notificationService: AuctionNotificationService,
    private readonly authService: WebSocketAuthService,
  ) {}

  /**
   * Process bid job
   */
  @Process(JOB_TYPES.PROCESS_BID)
  async processBid(job: Job<BidQueueJobDto>): Promise<QueueJobResultDto> {
    const startTime = Date.now();
    const { auctionId, bidderId, amount, bidType, source, clientIp } = job.data;

    this.logger.log(
      `Processing bid job ${job.id}: auction=${auctionId}, bidder=${bidderId}, amount=${amount}`,
    );

    try {
      // Update job progress
      await job.progress(10);

      // Validate bidding permission
      const canBid = await this.authService.validateBiddingPermission(
        bidderId,
        auctionId,
      );
      if (!canBid) {
        throw new Error('Bidding permission denied');
      }

      await job.progress(30);

      // Validate bid amount
      const bidValidation = await this.authService.validateBidAmount(
        auctionId,
        amount,
      );
      if (!bidValidation.valid) {
        throw new Error(bidValidation.reason || 'Invalid bid amount');
      }

      await job.progress(50);

      // Validate sufficient balance
      const hasBalance = await this.authService.validateSufficientBalance(
        bidderId,
        amount,
      );
      if (!hasBalance) {
        throw new Error('Insufficient balance');
      }

      await job.progress(70);

      // Place the bid with conflict resolution
      const bid = await this.placeBidWithRetry(
        auctionId,
        bidderId,
        amount,
        bidType,
        {
          source,
          clientIp,
          queueJobId: job.id?.toString(),
          timestamp: job.data.timestamp,
        },
        3, // max retries for conflict resolution
      );

      await job.progress(90);

      // Send notifications
      await this.sendBidNotifications(auctionId, bid);

      await job.progress(100);

      const processingTime = Date.now() - startTime;
      const result: QueueJobResultDto = {
        success: true,
        bidId: bid._id.toString(),
        processingTime,
        retryCount: job.attemptsMade,
        completedAt: new Date().toISOString(),
      };

      this.logger.log(
        `Bid processed successfully: ${bid._id} (${processingTime}ms, ${job.attemptsMade} attempts)`,
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const result: QueueJobResultDto = {
        success: false,
        error: error.message,
        processingTime,
        retryCount: job.attemptsMade,
        completedAt: new Date().toISOString(),
      };

      this.logger.error(
        `Bid processing failed: job=${job.id}, error=${error.message} (${processingTime}ms, ${job.attemptsMade} attempts)`,
      );

      // Determine if error is retryable
      if (this.isRetryableError(error)) {
        throw error; // Let Bull handle the retry
      }

      return result; // Don't retry for non-retryable errors
    }
  }

  /**
   * Place bid with conflict resolution retry logic
   */
  private async placeBidWithRetry(
    auctionId: string,
    bidderId: string,
    amount: number,
    bidType: any,
    metadata: any,
    maxRetries: number,
  ): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const bid = await this.auctionService.placeBid(
          new Types.ObjectId(auctionId),
          new Types.ObjectId(bidderId),
          amount,
          bidType,
          metadata,
        );

        if (attempt > 1) {
          this.logger.log(`Bid placed successfully on attempt ${attempt}`);
        }

        return bid;
      } catch (error) {
        lastError = error;

        // Check if this is a conflict error (e.g., bid amount too low due to concurrent bid)
        if (this.isConflictError(error) && attempt < maxRetries) {
          this.logger.warn(
            `Bid conflict detected on attempt ${attempt}, retrying... (${error.message})`,
          );

          // Wait a bit before retrying to allow other bids to settle
          await this.delay(100 * attempt);

          // Re-validate bid amount in case auction state changed
          const bidValidation = await this.authService.validateBidAmount(
            auctionId,
            amount,
          );
          if (!bidValidation.valid) {
            throw new Error(
              `Bid no longer valid after conflict: ${bidValidation.reason}`,
            );
          }

          continue;
        }

        // If not a conflict error or max retries reached, throw the error
        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * Send bid-related notifications
   */
  private async sendBidNotifications(
    auctionId: string,
    bid: any,
  ): Promise<void> {
    try {
      // Get updated auction data
      const auction = await this.auctionService.getAuctionById(
        new Types.ObjectId(auctionId),
        true,
      );

      if (!auction) {
        this.logger.warn(`Auction not found for notifications: ${auctionId}`);
        return;
      }

      // Notify about new bid
      await this.notificationService.notifyNewBid(auctionId, bid, auction);

      // If there was a previous highest bidder, notify them they were outbid
      if (
        auction.currentWinner &&
        auction.currentWinner.toString() !== bid.bidderId.toString()
      ) {
        await this.notificationService.notifyBidOutbid(
          auction.currentWinner.toString(),
          auctionId,
          null, // Previous bid (would need to fetch)
          bid,
        );
      }
    } catch (error) {
      // Don't fail the job if notifications fail
      this.logger.error(`Error sending bid notifications: ${error.message}`);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'connection timeout',
      'network error',
      'database connection',
      'temporary failure',
      'service unavailable',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((retryableError) =>
      errorMessage.includes(retryableError),
    );
  }

  /**
   * Check if error is due to bid conflict
   */
  private isConflictError(error: Error): boolean {
    const conflictErrors = [
      'bid amount too low',
      'minimum bid increment',
      'auction state changed',
      'concurrent modification',
    ];

    const errorMessage = error.message.toLowerCase();
    return conflictErrors.some((conflictError) =>
      errorMessage.includes(conflictError),
    );
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle job completion
   */
  @Process('completed')
  async onCompleted(job: Job, result: QueueJobResultDto): Promise<void> {
    this.logger.log(
      `Job completed: ${job.id} (success: ${result.success}, time: ${result.processingTime}ms)`,
    );
  }

  /**
   * Handle job failure
   */
  @Process('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Job failed: ${job.id} after ${job.attemptsMade} attempts - ${error.message}`,
    );

    // Could implement additional failure handling here:
    // - Send alerts for critical failures
    // - Store failed jobs for manual review
    // - Implement dead letter queue logic
  }

  /**
   * Handle job stalled
   */
  @Process('stalled')
  async onStalled(job: Job): Promise<void> {
    this.logger.warn(`Job stalled: ${job.id} - may need manual intervention`);
  }
}
