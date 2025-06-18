import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationTemplate } from '../schemas/notification-template.schema';
import { CreateNotificationTemplateDto } from '../dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';
import { NotificationTemplateFilterDto } from '../dto/notification-template-filter.dto';

/**
 * Service for notification template operations
 */
@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(
    @InjectModel(NotificationTemplate.name)
    private readonly templateModel: Model<NotificationTemplate>,
  ) {}

  /**
   * Create a new notification template
   */
  async create(
    createTemplateDto: CreateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    try {
      const template = new this.templateModel({
        ...createTemplateDto,
        version: createTemplateDto.version || '1.0.0',
        isActive: createTemplateDto.isActive ?? true,
        usage: {
          totalUsed: 0,
          lastUsed: null,
          averageDeliveryTime: 0,
          successRate: 0,
        },
      });

      const savedTemplate = await template.save();
      this.logger.log(`Created template: ${savedTemplate.templateId}`);
      return savedTemplate;
    } catch (error) {
      this.logger.error(
        `Failed to create template: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find all templates with filtering and pagination
   */
  async findAll(filterDto: NotificationTemplateFilterDto): Promise<{
    templates: NotificationTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        notificationType,
        contentType,
        channel,
        category,
        isActive,
        version,
        tag,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filterDto;

      // Build query
      const query: any = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { templateId: { $regex: search, $options: 'i' } },
        ];
      }

      if (notificationType) {
        query.notificationType = notificationType;
      }

      if (contentType) {
        query.contentType = contentType;
      }

      if (channel) {
        query.supportedChannels = { $in: [channel] };
      }

      if (category) {
        query.category = category;
      }

      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      if (version) {
        query.version = version;
      }

      if (tag) {
        query.tags = { $in: [tag] };
      }

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [templates, total] = await Promise.all([
        this.templateModel
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        this.templateModel.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.logger.log(
        `Found ${templates.length} templates (total: ${total}, page: ${page}/${totalPages})`,
      );

      return {
        templates,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to find templates: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find a single template by ID
   */
  async findOne(
    id: Types.ObjectId,
    version?: string,
  ): Promise<NotificationTemplate | null> {
    try {
      const query: any = { _id: id };
      if (version) {
        query.version = version;
      }

      const template = await this.templateModel.findOne(query).lean();

      if (template) {
        this.logger.debug(`Found template: ${template.templateId}`);
      } else {
        this.logger.debug(`Template not found: ${id}`);
      }

      return template;
    } catch (error) {
      this.logger.error(
        `Failed to find template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find template by templateId
   */
  async findByTemplateId(
    templateId: string,
    version?: string,
  ): Promise<NotificationTemplate | null> {
    try {
      const query: any = { templateId };
      if (version) {
        query.version = version;
      }

      const template = await this.templateModel.findOne(query).lean();

      if (template) {
        this.logger.debug(`Found template by templateId: ${templateId}`);
      } else {
        this.logger.debug(`Template not found by templateId: ${templateId}`);
      }

      return template;
    } catch (error) {
      this.logger.error(
        `Failed to find template by templateId ${templateId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a template
   */
  async update(
    id: Types.ObjectId,
    updateTemplateDto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate | null> {
    try {
      const template = await this.templateModel
        .findByIdAndUpdate(
          id,
          { ...updateTemplateDto, updatedAt: new Date() },
          { new: true },
        )
        .lean();

      if (template) {
        this.logger.log(`Updated template: ${template.templateId}`);
      } else {
        this.logger.warn(`Template not found for update: ${id}`);
      }

      return template;
    } catch (error) {
      this.logger.error(
        `Failed to update template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a template (soft delete)
   */
  async delete(id: Types.ObjectId): Promise<boolean> {
    try {
      const result = await this.templateModel.findByIdAndUpdate(
        id,
        { isActive: false, updatedAt: new Date() },
        { new: true },
      );

      if (result) {
        this.logger.log(`Soft deleted template: ${result.templateId}`);
        return true;
      } else {
        this.logger.warn(`Template not found for deletion: ${id}`);
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Hard delete a template
   */
  async hardDelete(id: Types.ObjectId): Promise<boolean> {
    try {
      const result = await this.templateModel.findByIdAndDelete(id);

      if (result) {
        this.logger.log(`Hard deleted template: ${result.templateId}`);
        return true;
      } else {
        this.logger.warn(`Template not found for hard deletion: ${id}`);
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Failed to hard delete template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update template usage statistics
   */
  async updateUsageStats(
    id: Types.ObjectId,
    deliveryTime?: number,
    success: boolean = true,
  ): Promise<void> {
    try {
      const template = await this.templateModel.findById(id);
      if (!template) {
        this.logger.warn(`Template not found for usage update: ${id}`);
        return;
      }

      // Update usage statistics
      template.usage.totalUsed += 1;
      template.usage.lastUsed = new Date();

      if (deliveryTime) {
        // Calculate moving average delivery time
        const currentTotal = template.usage.totalUsed - 1;
        const currentAvg = template.usage.averageDeliveryTime;
        template.usage.averageDeliveryTime =
          (currentAvg * currentTotal + deliveryTime) / template.usage.totalUsed;
      }

      // Calculate success rate (simple moving calculation)
      if (template.usage.totalUsed === 1) {
        template.usage.successRate = success ? 1 : 0;
      } else {
        const currentSuccessCount = Math.round(
          template.usage.successRate * (template.usage.totalUsed - 1),
        );
        const newSuccessCount = currentSuccessCount + (success ? 1 : 0);
        template.usage.successRate = newSuccessCount / template.usage.totalUsed;
      }

      await template.save();
      this.logger.debug(
        `Updated usage stats for template: ${template.templateId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update usage stats for template ${id}: ${error.message}`,
        error.stack,
      );
      // Don't throw - this is a background operation
    }
  }

  /**
   * Get templates by notification type
   */
  async findByNotificationType(
    notificationType: string,
    isActive: boolean = true,
  ): Promise<NotificationTemplate[]> {
    try {
      const templates = await this.templateModel
        .find({ notificationType, isActive })
        .sort({ version: -1 })
        .lean();

      this.logger.debug(
        `Found ${templates.length} templates for type: ${notificationType}`,
      );

      return templates;
    } catch (error) {
      this.logger.error(
        `Failed to find templates by type ${notificationType}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get template statistics summary
   */
  async getStatisticsSummary(): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    inactiveTemplates: number;
    totalUsage: number;
    averageSuccessRate: number;
    mostUsedTemplate: NotificationTemplate | null;
  }> {
    try {
      const [stats, mostUsed] = await Promise.all([
        this.templateModel.aggregate([
          {
            $group: {
              _id: null,
              totalTemplates: { $sum: 1 },
              activeTemplates: {
                $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
              },
              inactiveTemplates: {
                $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] },
              },
              totalUsage: { $sum: '$usage.totalUsed' },
              averageSuccessRate: { $avg: '$usage.successRate' },
            },
          },
        ]),
        this.templateModel
          .findOne({ isActive: true })
          .sort({ 'usage.totalUsed': -1 })
          .lean(),
      ]);

      const summary = stats[0] || {
        totalTemplates: 0,
        activeTemplates: 0,
        inactiveTemplates: 0,
        totalUsage: 0,
        averageSuccessRate: 0,
      };

      return {
        ...summary,
        mostUsedTemplate: mostUsed,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get statistics summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
