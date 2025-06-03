import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { AdminGuard } from 'src/auth/admin/admin.guard';
import { NotificationTemplateService } from '../services/notification-template.service';
import {
  NotificationTemplateEngineService,
  TemplateValidationResult,
} from '../services/notification-template-engine.service';
import { CreateNotificationTemplateDto } from '../dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';
import { NotificationTemplateFilterDto } from '../dto/notification-template-filter.dto';
import { NotificationTemplate } from '../schemas/notification-template.schema';

/**
 * Admin controller for notification template management
 */
@ApiTags('Admin Notification Templates')
@Controller('admin/notification-templates')
@UseGuards(JwtAuthGuard, AdminGuard)
export class NotificationTemplateAdminController {
  private readonly logger = new Logger(
    NotificationTemplateAdminController.name,
  );

  constructor(
    private readonly templateService: NotificationTemplateService,
    private readonly templateEngineService: NotificationTemplateEngineService,
  ) {}

  /**
   * Get all notification templates with filtering and pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Get notification templates',
    description:
      'Retrieve all notification templates with filtering and pagination support',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Templates retrieved successfully',
    type: [NotificationTemplate],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: 'auction',
  })
  @ApiQuery({ name: 'notificationType', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async getTemplates(
    @Query(ValidationPipe) filterDto: NotificationTemplateFilterDto,
  ): Promise<{
    templates: NotificationTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const result = await this.templateService.findAll(filterDto);

      this.logger.log(`Retrieved ${result.templates.length} templates`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get templates: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a specific notification template by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get notification template by ID',
    description: 'Retrieve a specific notification template with all details',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'version',
    required: false,
    type: String,
    example: '1.0.0',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template retrieved successfully',
    type: NotificationTemplate,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  async getTemplate(
    @Param('id') id: string,
    @Query('version') version?: string,
  ): Promise<NotificationTemplate> {
    try {
      const templateId = new Types.ObjectId(id);
      const template = await this.templateService.findOne(templateId, version);

      if (!template) {
        throw new Error('Template not found');
      }

      this.logger.log(`Retrieved template ${id}`);
      return template;
    } catch (error) {
      this.logger.error(
        `Failed to get template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create a new notification template
   */
  @Post()
  @ApiOperation({
    summary: 'Create notification template',
    description: 'Create a new notification template with validation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Template created successfully',
    type: NotificationTemplate,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid template data or validation failed',
  })
  async createTemplate(
    @Body(ValidationPipe) createTemplateDto: CreateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    try {
      // Validate template syntax before creating
      const validationResult =
        await this.templateEngineService.validateTemplate(
          createTemplateDto.messageTemplate,
          createTemplateDto.titleTemplate,
          createTemplateDto.actionTemplates,
        );

      if (!validationResult.isValid) {
        throw new Error(
          `Template validation failed: ${validationResult.errors.join(', ')}`,
        );
      }

      const template = await this.templateService.create(createTemplateDto);

      // Clear cache to ensure new template is loaded
      await this.templateEngineService.clearTemplateCache();

      this.logger.log(`Created template ${template.templateId}`);
      return template;
    } catch (error) {
      this.logger.error(
        `Failed to create template: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update an existing notification template
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update notification template',
    description: 'Update an existing notification template with validation',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template updated successfully',
    type: NotificationTemplate,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid template data or validation failed',
  })
  async updateTemplate(
    @Param('id') id: string,
    @Body(ValidationPipe) updateTemplateDto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    try {
      const templateId = new Types.ObjectId(id);

      // Validate template syntax if templates are being updated
      if (
        updateTemplateDto.messageTemplate ||
        updateTemplateDto.titleTemplate
      ) {
        const existing = await this.templateService.findOne(templateId);
        if (!existing) {
          throw new Error('Template not found');
        }

        const validationResult =
          await this.templateEngineService.validateTemplate(
            updateTemplateDto.messageTemplate || existing.messageTemplate,
            updateTemplateDto.titleTemplate || existing.titleTemplate,
            updateTemplateDto.actionTemplates || existing.actionTemplates,
          );

        if (!validationResult.isValid) {
          throw new Error(
            `Template validation failed: ${validationResult.errors.join(', ')}`,
          );
        }
      }

      const template = await this.templateService.update(
        templateId,
        updateTemplateDto,
      );

      if (!template) {
        throw new Error('Template not found');
      }

      // Clear cache for this template
      await this.templateEngineService.clearTemplateCache(templateId);

      this.logger.log(`Updated template ${id}`);
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
   * Delete a notification template
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification template',
    description:
      'Delete a notification template (soft delete by setting isActive to false)',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  async deleteTemplate(@Param('id') id: string): Promise<{ message: string }> {
    try {
      const templateId = new Types.ObjectId(id);
      await this.templateService.delete(templateId);

      // Clear cache for this template
      await this.templateEngineService.clearTemplateCache(templateId);

      this.logger.log(`Deleted template ${id}`);
      return { message: 'Template deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to delete template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate template syntax and variables
   */
  @Post('validate')
  @ApiOperation({
    summary: 'Validate template syntax',
    description:
      'Validate template syntax and extract variables without creating the template',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template validation completed',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        variables: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async validateTemplate(
    @Body()
    validateDto: {
      titleTemplate: string;
      messageTemplate: string;
      actionTemplates?: any[];
    },
  ): Promise<TemplateValidationResult> {
    try {
      const result = await this.templateEngineService.validateTemplate(
        validateDto.messageTemplate,
        validateDto.titleTemplate,
        validateDto.actionTemplates,
      );

      this.logger.log(
        `Template validation: ${result.isValid ? 'PASSED' : 'FAILED'}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Template validation error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Preview template rendering with sample data
   */
  @Post(':id/preview')
  @ApiOperation({
    summary: 'Preview template rendering',
    description: 'Preview how a template will render with provided sample data',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template preview generated successfully',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        message: { type: 'string' },
        metadata: { type: 'object' },
        actions: { type: 'array' },
      },
    },
  })
  async previewTemplate(
    @Param('id') id: string,
    @Body()
    previewDto: {
      context: any;
      version?: string;
    },
  ) {
    try {
      const templateId = new Types.ObjectId(id);
      const result = await this.templateEngineService.renderTemplate(
        templateId,
        previewDto.context,
        previewDto.version,
      );

      this.logger.log(`Generated preview for template ${id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to preview template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get template usage statistics
   */
  @Get(':id/statistics')
  @ApiOperation({
    summary: 'Get template usage statistics',
    description: 'Get detailed usage statistics for a specific template',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template statistics retrieved successfully',
  })
  async getTemplateStatistics(@Param('id') id: string) {
    try {
      const templateId = new Types.ObjectId(id);
      const template = await this.templateService.findOne(templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      this.logger.log(`Retrieved statistics for template ${id}`);
      return {
        templateId: template.templateId,
        name: template.name,
        usage: template.usage,
        isActive: template.isActive,
        version: template.version,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get template statistics ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create a new version of an existing template
   */
  @Post(':id/versions')
  @ApiOperation({
    summary: 'Create template version',
    description: 'Create a new version of an existing template',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Template version created successfully',
    type: NotificationTemplate,
  })
  async createTemplateVersion(
    @Param('id') id: string,
    @Body(ValidationPipe) updateTemplateDto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    try {
      const templateId = new Types.ObjectId(id);
      const existingTemplate = await this.templateService.findOne(templateId);

      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      // Increment version number
      const currentVersion = existingTemplate.version || '1.0.0';
      const versionParts = currentVersion.split('.').map(Number);
      versionParts[1] += 1; // Increment minor version
      const newVersion = versionParts.join('.');

      // Validate new template
      const validationResult =
        await this.templateEngineService.validateTemplate(
          updateTemplateDto.messageTemplate || existingTemplate.messageTemplate,
          updateTemplateDto.titleTemplate || existingTemplate.titleTemplate,
          updateTemplateDto.actionTemplates || existingTemplate.actionTemplates,
        );

      if (!validationResult.isValid) {
        throw new Error(
          `Template validation failed: ${validationResult.errors.join(', ')}`,
        );
      }

      // Create new version
      const newTemplateData = {
        ...existingTemplate.toObject(),
        ...updateTemplateDto,
        version: newVersion,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      delete newTemplateData.__v;
      const newTemplate = await this.templateService.create(newTemplateData);

      // Clear cache
      await this.templateEngineService.clearTemplateCache(templateId);

      this.logger.log(`Created version ${newVersion} for template ${id}`);
      return newTemplate;
    } catch (error) {
      this.logger.error(
        `Failed to create template version ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clear template cache
   */
  @Post('cache/clear')
  @ApiOperation({
    summary: 'Clear template cache',
    description: 'Clear the template cache to force reload from database',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cache cleared successfully',
  })
  async clearCache(): Promise<{ message: string }> {
    try {
      await this.templateEngineService.clearTemplateCache();
      this.logger.log('Template cache cleared');
      return { message: 'Template cache cleared successfully' };
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${error.message}`, error.stack);
      throw error;
    }
  }
}
