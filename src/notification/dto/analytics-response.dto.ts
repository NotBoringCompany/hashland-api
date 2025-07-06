import { ApiProperty } from '@nestjs/swagger';

/**
 * Notification analytics summary response DTO
 */
export class NotificationAnalyticsResponseDto {
  @ApiProperty({ example: 1500, description: 'Total notifications sent' })
  totalNotifications: number;

  @ApiProperty({ example: 1200, description: 'Total notifications delivered' })
  totalDelivered: number;

  @ApiProperty({ example: 50, description: 'Total notifications failed' })
  totalFailed: number;

  @ApiProperty({ example: 800, description: 'Total notifications read' })
  totalRead: number;

  @ApiProperty({ example: 450, description: 'Total notification clicks' })
  totalClicks: number;

  @ApiProperty({ example: 120, description: 'Total notification conversions' })
  totalConversions: number;

  @ApiProperty({ example: 950, description: 'Total notification impressions' })
  totalImpressions: number;

  @ApiProperty({ example: 80.0, description: 'Delivery rate percentage' })
  deliveryRate: number;

  @ApiProperty({ example: 66.7, description: 'Read rate percentage' })
  readRate: number;

  @ApiProperty({ example: 47.4, description: 'Click-through rate percentage' })
  clickRate: number;

  @ApiProperty({ example: 26.7, description: 'Conversion rate percentage' })
  conversionRate: number;

  @ApiProperty({
    example: { auction_bid: 450, system_alert: 200, achievement: 150 },
    description: 'Breakdown by notification type',
  })
  byType: Record<string, number>;

  @ApiProperty({
    example: { critical: 100, high: 350, medium: 800, low: 250 },
    description: 'Breakdown by priority level',
  })
  byPriority: Record<string, number>;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Report generation timestamp',
  })
  generatedAt: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Data period start',
  })
  periodStart?: string;

  @ApiProperty({
    example: '2024-01-31T23:59:59.000Z',
    description: 'Data period end',
  })
  periodEnd?: string;
}

/**
 * Delivery statistics response DTO
 */
export class DeliveryStatsResponseDto {
  @ApiProperty({
    example: 'Last 7 days',
    description: 'Statistics period description',
  })
  period: string;

  @ApiProperty({
    example: '2024-01-08T00:00:00.000Z',
    description: 'Period start date',
  })
  dateFrom: string;

  @ApiProperty({
    example: '2024-01-15T23:59:59.000Z',
    description: 'Period end date',
  })
  dateTo: string;

  @ApiProperty({ example: 1500, description: 'Total notifications sent' })
  totalNotifications: number;

  @ApiProperty({
    example: 1200,
    description: 'Successfully delivered notifications',
  })
  totalDelivered: number;

  @ApiProperty({ example: 50, description: 'Failed delivery notifications' })
  totalFailed: number;

  @ApiProperty({ example: 250, description: 'Notifications pending delivery' })
  totalPending: number;

  @ApiProperty({ example: 80.0, description: 'Overall delivery success rate' })
  deliveryRate: number;

  @ApiProperty({ example: 3.33, description: 'Failure rate percentage' })
  failureRate: number;

  @ApiProperty({
    example: 8.5,
    description: 'Average delivery time in seconds',
  })
  avgDeliveryTime: number;

  @ApiProperty({
    example: [
      { date: '2024-01-15', sent: 200, delivered: 180, failed: 5 },
      { date: '2024-01-14', sent: 180, delivered: 170, failed: 3 },
    ],
    description: 'Daily breakdown of delivery statistics',
  })
  dailyStats: Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;

  @ApiProperty({
    example: { websocket: 900, database: 600 },
    description: 'Delivery channel breakdown',
  })
  byChannel: Record<string, number>;
}

/**
 * User engagement metrics response DTO
 */
export class EngagementMetricsResponseDto {
  @ApiProperty({
    example: 'Last 30 days',
    description: 'Metrics period description',
  })
  period: string;

  @ApiProperty({ example: 'All users', description: 'User scope for metrics' })
  userId: string;

  @ApiProperty({
    example: 47.5,
    description: 'Overall engagement rate percentage',
  })
  engagementRate: number;

  @ApiProperty({ example: 1500, description: 'Total notifications sent' })
  totalNotifications: number;

  @ApiProperty({ example: 950, description: 'Total notification impressions' })
  totalImpressions: number;

  @ApiProperty({ example: 800, description: 'Total notifications read' })
  totalRead: number;

  @ApiProperty({ example: 450, description: 'Total notification clicks' })
  totalClicks: number;

  @ApiProperty({
    example: 120,
    description: 'Total conversions from notifications',
  })
  totalConversions: number;

  @ApiProperty({ example: 63.3, description: 'Impression rate percentage' })
  impressionRate: number;

  @ApiProperty({ example: 53.3, description: 'Read rate percentage' })
  readRate: number;

  @ApiProperty({ example: 47.4, description: 'Click-through rate percentage' })
  clickThroughRate: number;

  @ApiProperty({ example: 26.7, description: 'Conversion rate percentage' })
  conversionRate: number;

  @ApiProperty({
    example: 15.5,
    description: 'Average time to read in minutes',
  })
  avgTimeToRead: number;

  @ApiProperty({
    example: 5.2,
    description: 'Average time to click in minutes',
  })
  avgTimeToClick: number;

  @ApiProperty({
    example: [
      { date: '2024-01-15', impressions: 45, reads: 30, clicks: 15 },
      { date: '2024-01-14', impressions: 42, reads: 28, clicks: 12 },
    ],
    description: 'Daily engagement breakdown',
  })
  dailyEngagement: Array<{
    date: string;
    impressions: number;
    reads: number;
    clicks: number;
    conversions?: number;
  }>;

  @ApiProperty({
    example: { auction_bid: 75.0, system_alert: 90.0, achievement: 60.0 },
    description: 'Engagement rates by notification type',
  })
  engagementByType: Record<string, number>;
}

/**
 * Template statistics response DTO
 */
export class TemplateStatisticsResponseDto {
  @ApiProperty({
    example: 'auction_bid_notification',
    description: 'Template identifier',
  })
  templateId: string;

  @ApiProperty({
    example: 'Auction Bid Notification',
    description: 'Template display name',
  })
  name: string;

  @ApiProperty({
    example: 150,
    description: 'Number of times template was used',
  })
  usage: number;

  @ApiProperty({
    example: true,
    description: 'Whether template is currently active',
  })
  isActive: boolean;

  @ApiProperty({ example: '1.2.0', description: 'Current template version' })
  version: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Template creation date',
  })
  createdAt: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update date',
  })
  updatedAt: string;

  @ApiProperty({
    example: 1200,
    description: 'Total notifications sent using this template',
  })
  totalSent: number;

  @ApiProperty({
    example: 800,
    description: 'Notifications read using this template',
  })
  totalRead: number;

  @ApiProperty({ example: 450, description: 'Clicks from this template' })
  totalClicks: number;

  @ApiProperty({ example: 66.7, description: 'Read rate for this template' })
  readRate: number;

  @ApiProperty({ example: 37.5, description: 'Click rate for this template' })
  clickRate: number;

  @ApiProperty({
    example: '2024-01-15T09:45:00.000Z',
    description: 'Last time template was used',
  })
  lastUsed?: string;
}
