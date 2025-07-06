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
  HttpCode,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
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
import { ApiResponse } from '../../common/dto/response.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';

/**
 * Admin controller for notification template management
 */
@ApiTags('Admin Notification Templates')
@Controller('admin/notification-templates')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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
  @SwaggerApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    type: PaginatedResponse.withType(NotificationTemplate),
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
    @Query() filterDto: NotificationTemplateFilterDto,
  ): Promise<PaginatedResponse<NotificationTemplate>> {
    try {
      const result = await this.templateService.findAll(filterDto);

      this.logger.log(`Retrieved ${result.templates.length} templates`);

      return new PaginatedResponse(
        HttpStatus.OK,
        'Templates retrieved successfully',
        {
          items: result.templates,
          page: result.page,
          limit: filterDto.limit || 20,
          total: result.total,
        },
      );
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
  @SwaggerApiResponse({
    status: 200,
    description: 'Template retrieved successfully',
    type: ApiResponse.withType(NotificationTemplate),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Template not found',
    type: ApiResponse,
  })
  async getTemplate(
    @Param('id') id: string,
    @Query('version') version?: string,
  ): Promise<ApiResponse<NotificationTemplate>> {
    try {
      const templateId = new Types.ObjectId(id);
      const template = await this.templateService.findOne(templateId, version);

      if (!template) {
        return new ApiResponse(
          HttpStatus.NOT_FOUND,
          'Template not found',
          null,
        );
      }

      this.logger.log(`Retrieved template ${id}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Template retrieved successfully',
        template,
      );
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create notification template',
    description: 'Create a new notification template with validation',
  })
  @ApiBody({ type: CreateNotificationTemplateDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Template created successfully',
    type: ApiResponse.withType(NotificationTemplate),
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Invalid template data or validation failed',
    type: ApiResponse,
  })
  async createTemplate(
    @Body() createTemplateDto: CreateNotificationTemplateDto,
  ): Promise<ApiResponse<NotificationTemplate>> {
    try {
      // Validate template syntax before creating
      const validationResult =
        await this.templateEngineService.validateTemplate(
          createTemplateDto.messageTemplate,
          createTemplateDto.titleTemplate,
          createTemplateDto.actionTemplates,
        );

      if (!validationResult.isValid) {
        return new ApiResponse(
          HttpStatus.BAD_REQUEST,
          `Template validation failed: ${validationResult.errors.join(', ')}`,
          null,
        );
      }

      const template = await this.templateService.create(createTemplateDto);

      // Clear cache to ensure new template is loaded
      await this.templateEngineService.clearTemplateCache();

      this.logger.log(`Created template ${template.templateId}`);
      return new ApiResponse(
        HttpStatus.CREATED,
        'Template created successfully',
        template,
      );
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
  @ApiBody({ type: UpdateNotificationTemplateDto })
  @SwaggerApiResponse({
    status: 200,
    description: 'Template updated successfully',
    type: ApiResponse.withType(NotificationTemplate),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Template not found',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Invalid template data or validation failed',
    type: ApiResponse,
  })
  async updateTemplate(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateNotificationTemplateDto,
  ): Promise<ApiResponse<NotificationTemplate>> {
    try {
      const templateId = new Types.ObjectId(id);

      // Validate template syntax if templates are being updated
      if (
        updateTemplateDto.messageTemplate ||
        updateTemplateDto.titleTemplate
      ) {
        const existing = await this.templateService.findOne(templateId);
        if (!existing) {
          return new ApiResponse(
            HttpStatus.NOT_FOUND,
            'Template not found',
            null,
          );
        }

        const validationResult =
          await this.templateEngineService.validateTemplate(
            updateTemplateDto.messageTemplate || existing.messageTemplate,
            updateTemplateDto.titleTemplate || existing.titleTemplate,
            updateTemplateDto.actionTemplates || existing.actionTemplates,
          );

        if (!validationResult.isValid) {
          return new ApiResponse(
            HttpStatus.BAD_REQUEST,
            `Template validation failed: ${validationResult.errors.join(', ')}`,
            null,
          );
        }
      }

      const template = await this.templateService.update(
        templateId,
        updateTemplateDto,
      );

      // Clear cache to ensure updated template is loaded
      await this.templateEngineService.clearTemplateCache();

      this.logger.log(`Updated template ${id}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Template updated successfully',
        template,
      );
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
    description: 'Delete a notification template by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Template deleted successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Template not found',
    type: ApiResponse,
  })
  async deleteTemplate(@Param('id') id: string): Promise<ApiResponse<null>> {
    try {
      const templateId = new Types.ObjectId(id);
      await this.templateService.delete(templateId);

      // Clear cache to ensure deleted template is removed
      await this.templateEngineService.clearTemplateCache();

      this.logger.log(`Deleted template ${id}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Template deleted successfully',
        null,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete template ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate template syntax
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate template syntax',
    description: 'Validate notification template syntax and variables',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        titleTemplate: { type: 'string', example: 'Hello {{user.name}}!' },
        messageTemplate: {
          type: 'string',
          example: 'You have a new bid of {{amount}} HASH',
        },
        actionTemplates: {
          type: 'array',
          items: { type: 'object' },
          example: [{ type: 'button', text: 'View Details' }],
        },
      },
      required: ['titleTemplate', 'messageTemplate'],
    },
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Template validation completed',
    type: ApiResponse,
  })
  async validateTemplate(
    @Body()
    validateDto: {
      titleTemplate: string;
      messageTemplate: string;
      actionTemplates?: any[];
    },
  ): Promise<ApiResponse<TemplateValidationResult>> {
    try {
      const validationResult =
        await this.templateEngineService.validateTemplate(
          validateDto.messageTemplate,
          validateDto.titleTemplate,
          validateDto.actionTemplates,
        );

      this.logger.log(
        `Template validation: ${validationResult.isValid ? 'passed' : 'failed'}`,
      );

      return new ApiResponse(
        HttpStatus.OK,
        validationResult.isValid
          ? 'Template validation passed'
          : 'Template validation failed',
        validationResult,
      );
    } catch (error) {
      this.logger.error(
        `Failed to validate template: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Preview template with sample data
   */
  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview template',
    description: 'Preview a template with provided context data',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        context: {
          type: 'object',
          example: { user: { name: 'John Doe' }, amount: 250 },
        },
        version: { type: 'string', example: '1.0.0' },
      },
      required: ['context'],
    },
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Template preview generated successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Template not found',
    type: ApiResponse,
  })
  async previewTemplate(
    @Param('id') id: string,
    @Body()
    previewDto: {
      context: any;
      version?: string;
    },
  ): Promise<ApiResponse<{ title: string; message: string; actions?: any[] }>> {
    try {
      const templateId = new Types.ObjectId(id);
      const template = await this.templateService.findOne(
        templateId,
        previewDto.version,
      );

      if (!template) {
        return new ApiResponse(
          HttpStatus.NOT_FOUND,
          'Template not found',
          null,
        );
      }

      const preview = await this.templateEngineService.renderTemplate(
        template.templateId,
        previewDto.context,
        previewDto.version,
      );

      this.logger.log(`Generated preview for template ${id}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Template preview generated successfully',
        preview,
      );
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
    summary: 'Get template statistics',
    description: 'Get usage statistics for a specific template',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Template statistics retrieved successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Template not found',
    type: ApiResponse,
  })
  async getTemplateStatistics(
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    try {
      const templateId = new Types.ObjectId(id);
      const template = await this.templateService.findOne(templateId);

      if (!template) {
        return new ApiResponse(
          HttpStatus.NOT_FOUND,
          'Template not found',
          null,
        );
      }

      // Basic statistics from template object since getUsageStatistics doesn't exist
      const statistics = {
        templateId: template.templateId,
        name: template.name,
        usage: template.usage || 0,
        isActive: template.isActive,
        version: template.version,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      };

      this.logger.log(`Retrieved statistics for template ${id}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Template statistics retrieved successfully',
        statistics,
      );
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create template version',
    description: 'Create a new version of an existing template',
  })
  @ApiParam({
    name: 'id',
    description: 'Template ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: UpdateNotificationTemplateDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Template version created successfully',
    type: ApiResponse.withType(NotificationTemplate),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Template not found',
    type: ApiResponse,
  })
  async createTemplateVersion(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateNotificationTemplateDto,
  ): Promise<ApiResponse<NotificationTemplate>> {
    try {
      const templateId = new Types.ObjectId(id);

      // Validate template syntax if provided
      if (
        updateTemplateDto.messageTemplate ||
        updateTemplateDto.titleTemplate
      ) {
        const existing = await this.templateService.findOne(templateId);
        if (!existing) {
          return new ApiResponse(
            HttpStatus.NOT_FOUND,
            'Template not found',
            null,
          );
        }

        const validationResult =
          await this.templateEngineService.validateTemplate(
            updateTemplateDto.messageTemplate || existing.messageTemplate,
            updateTemplateDto.titleTemplate || existing.titleTemplate,
            updateTemplateDto.actionTemplates || existing.actionTemplates,
          );

        if (!validationResult.isValid) {
          return new ApiResponse(
            HttpStatus.BAD_REQUEST,
            `Template validation failed: ${validationResult.errors.join(', ')}`,
            null,
          );
        }
      }

      // Since createVersion doesn't exist, update the existing template
      const updatedTemplate = await this.templateService.update(
        templateId,
        updateTemplateDto,
      );

      // Clear cache to ensure new version is loaded
      await this.templateEngineService.clearTemplateCache();

      this.logger.log(
        `Updated template ${id} (version functionality not available)`,
      );
      return new ApiResponse(
        HttpStatus.CREATED,
        'Template updated successfully (version functionality not available)',
        updatedTemplate,
      );
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear template cache',
    description: 'Clear all compiled template cache',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Template cache cleared successfully',
    type: ApiResponse,
  })
  async clearCache(): Promise<ApiResponse<{ clearedAt: string }>> {
    try {
      await this.templateEngineService.clearTemplateCache();
      const clearedAt = new Date().toISOString();

      this.logger.log('Template cache cleared');
      return new ApiResponse(
        HttpStatus.OK,
        'Template cache cleared successfully',
        { clearedAt },
      );
    } catch (error) {
      this.logger.error(
        `Failed to clear template cache: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
