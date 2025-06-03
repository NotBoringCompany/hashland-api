import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as Handlebars from 'handlebars';
import * as crypto from 'crypto';
import { NotificationTemplate } from '../schemas/notification-template.schema';
import { RedisService } from 'src/common/redis.service';

/**
 * Template context for variable substitution
 */
export interface TemplateContext {
  user?: {
    id: string;
    name: string;
    email?: string;
    level?: number;
    [key: string]: any;
  };
  system?: {
    appName: string;
    appUrl?: string;
    supportEmail?: string;
    timestamp: string;
    [key: string]: any;
  };
  notification?: {
    id: string;
    type: string;
    priority: string;
    [key: string]: any;
  };
  custom?: Record<string, any>;
  [key: string]: any;
}

/**
 * Compiled template cache entry
 */
interface CompiledTemplateCache {
  template: HandlebarsTemplateDelegate;
  compiledAt: Date;
  version: string;
  checksum: string;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
}

/**
 * Rendered template result
 */
export interface RenderedTemplate {
  title: string;
  message: string;
  metadata?: Record<string, any>;
  actions?: Array<{
    id: string;
    label: string;
    type: 'button' | 'link' | 'dismiss';
    url?: string;
    action?: string;
    style?: 'primary' | 'secondary' | 'danger' | 'success';
  }>;
  imageUrl?: string;
  iconUrl?: string;
}

/**
 * Service for template engine operations with Handlebars
 */
@Injectable()
export class NotificationTemplateEngineService implements OnModuleInit {
  private readonly logger = new Logger(NotificationTemplateEngineService.name);
  private readonly templateCache = new Map<string, CompiledTemplateCache>();
  private readonly cachePrefix = 'notification-template:';
  private readonly cacheTTL = 3600; // 1 hour

  constructor(
    @InjectModel(NotificationTemplate.name)
    private readonly templateModel: Model<NotificationTemplate>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Initialize template engine with custom helpers
   */
  async onModuleInit(): Promise<void> {
    this.registerHandlebarsHelpers();
    await this.preloadActiveTemplates();
    this.logger.log('NotificationTemplateEngineService initialized');
  }

  /**
   * Render template with given context
   */
  async renderTemplate(
    templateId: string | Types.ObjectId,
    context: TemplateContext,
    version?: string,
  ): Promise<RenderedTemplate> {
    try {
      // Get compiled template
      const compiledTemplate = await this.getCompiledTemplate(
        templateId,
        version,
      );

      if (!compiledTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Enhance context with system variables
      const enhancedContext = this.enhanceContext(context);

      // Render template sections
      const title = compiledTemplate.template({
        ...enhancedContext,
        section: 'title',
      });

      const message = compiledTemplate.template({
        ...enhancedContext,
        section: 'message',
      });

      // Get template document for additional data
      const template = await this.getTemplate(templateId, version);

      const result: RenderedTemplate = {
        title: title.trim(),
        message: message.trim(),
      };

      // Add metadata if present in template
      if (template.defaultMetadata) {
        result.metadata = this.renderObject(
          template.defaultMetadata,
          enhancedContext,
        );
      }

      // Render actions if present
      if (template.actionTemplates?.length) {
        result.actions = template.actionTemplates.map((action) => ({
          id: action.id,
          label: this.renderString(action.label, enhancedContext),
          type: action.type,
          url: action.url
            ? this.renderString(action.url, enhancedContext)
            : undefined,
          action: action.action,
          style: action.style,
        }));
      }

      this.logger.debug(`Template ${templateId} rendered successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to render template ${templateId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate template syntax and variables
   */
  async validateTemplate(
    templateContent: string,
    title: string,
    actions?: any[],
  ): Promise<TemplateValidationResult> {
    const result: TemplateValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      variables: [],
    };

    try {
      // Validate title template
      Handlebars.compile(title);
      result.variables.push(...this.extractVariables(title));

      // Validate message template
      Handlebars.compile(templateContent);
      result.variables.push(...this.extractVariables(templateContent));

      // Validate action templates
      if (actions?.length) {
        for (const action of actions) {
          if (action.label) {
            Handlebars.compile(action.label);
            result.variables.push(...this.extractVariables(action.label));
          }
          if (action.url) {
            Handlebars.compile(action.url);
            result.variables.push(...this.extractVariables(action.url));
          }
        }
      }

      // Remove duplicates
      result.variables = [...new Set(result.variables)];

      // Check for common issues
      this.validateTemplateStructure(templateContent, result);
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Template compilation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Get compiled template from cache or database
   */
  async getCompiledTemplate(
    templateId: string | Types.ObjectId,
    version?: string,
  ): Promise<CompiledTemplateCache | null> {
    const cacheKey = `${templateId}_${version || 'latest'}`;

    // Check in-memory cache first
    if (this.templateCache.has(cacheKey)) {
      const cached = this.templateCache.get(cacheKey)!;
      this.logger.debug(`Template ${templateId} found in memory cache`);
      return cached;
    }

    // Check Redis cache
    const redisCacheKey = `${this.cachePrefix}${cacheKey}`;
    const cached = await this.redisService.get(redisCacheKey);

    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        const template = Handlebars.compile(parsedCache.templateSource);

        const compiledCache: CompiledTemplateCache = {
          template,
          compiledAt: new Date(parsedCache.compiledAt),
          version: parsedCache.version,
          checksum: parsedCache.checksum,
        };

        // Store in memory cache
        this.templateCache.set(cacheKey, compiledCache);
        this.logger.debug(`Template ${templateId} found in Redis cache`);
        return compiledCache;
      } catch (error) {
        this.logger.warn(`Failed to parse cached template: ${error.message}`);
      }
    }

    // Load from database and compile
    return await this.loadAndCompileTemplate(templateId, version);
  }

  /**
   * Clear template cache
   */
  async clearTemplateCache(
    templateId?: string | Types.ObjectId,
  ): Promise<void> {
    if (templateId) {
      // Clear specific template
      const pattern = `${templateId}_`;
      const keysToDelete = Array.from(this.templateCache.keys()).filter((key) =>
        key.startsWith(pattern),
      );

      for (const key of keysToDelete) {
        this.templateCache.delete(key);
      }

      this.logger.debug(`Cleared cache for template ${templateId}`);
    } else {
      // Clear all templates
      this.templateCache.clear();
      this.logger.log('Cleared all template caches');
    }
  }

  /**
   * Preload active templates into cache
   */
  private async preloadActiveTemplates(): Promise<void> {
    try {
      const activeTemplates = await this.templateModel
        .find({ isActive: true })
        .select('_id templateId version')
        .lean();

      for (const template of activeTemplates) {
        await this.getCompiledTemplate(template._id);
      }

      this.logger.log(
        `Preloaded ${activeTemplates.length} active templates into cache`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to preload templates: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date, format?: string) => {
      if (!date) return '';
      const d = new Date(date);
      return format === 'time'
        ? d.toLocaleTimeString()
        : d.toLocaleDateString();
    });

    // Currency formatting helper
    Handlebars.registerHelper(
      'formatCurrency',
      (amount: number, currency = 'USD') => {
        if (typeof amount !== 'number') return '0';
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(amount);
      },
    );

    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      return typeof str === 'string' ? str.toUpperCase() : '';
    });

    // Conditional helper
    Handlebars.registerHelper(
      'ifEquals',
      function (arg1: any, arg2: any, options: any) {
        return arg1 === arg2 ? options.fn(this) : options.inverse(this);
      },
    );

    // Default value helper
    Handlebars.registerHelper('default', (value: any, defaultValue: any) => {
      return value || defaultValue;
    });

    // Section helper for different template parts
    Handlebars.registerHelper('section', function (name: string, options: any) {
      if (this.section === name) {
        return options.fn(this);
      }
      return '';
    });

    this.logger.debug('Handlebars helpers registered');
  }

  /**
   * Load template from database and compile
   */
  private async loadAndCompileTemplate(
    templateId: string | Types.ObjectId,
    version?: string,
  ): Promise<CompiledTemplateCache | null> {
    try {
      const template = await this.getTemplate(templateId, version);
      if (!template) {
        return null;
      }

      // Create combined template source with sections
      const templateSource = `
        {{#section "title"}}${template.titleTemplate}{{/section}}
        {{#section "message"}}${template.messageTemplate}{{/section}}
      `;

      const compiledTemplate = Handlebars.compile(templateSource);
      const checksum = this.generateChecksum(templateSource);

      const compiled: CompiledTemplateCache = {
        template: compiledTemplate,
        compiledAt: new Date(),
        version: template.version,
        checksum,
      };

      const cacheKey = `${templateId}_${version || 'latest'}`;

      // Store in memory cache
      this.templateCache.set(cacheKey, compiled);

      // Store in Redis cache with TTL
      const redisCacheKey = `${this.cachePrefix}${cacheKey}`;
      await this.redisService.set(
        redisCacheKey,
        JSON.stringify({
          templateSource,
          compiledAt: compiled.compiledAt.toISOString(),
          version: compiled.version,
          checksum,
        }),
        this.cacheTTL,
      );

      this.logger.debug(`Template ${templateId} compiled and cached`);
      return compiled;
    } catch (error) {
      this.logger.error(
        `Failed to load and compile template ${templateId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get template from database
   */
  private async getTemplate(
    templateId: string | Types.ObjectId,
    version?: string,
  ): Promise<NotificationTemplate | null> {
    const query: any = { _id: templateId };

    if (version) {
      query.version = version;
    }

    const template = await this.templateModel.findOne(query).lean();
    return template;
  }

  /**
   * Enhance context with system variables
   */
  private enhanceContext(context: TemplateContext): TemplateContext {
    const enhanced = { ...context };

    // Add system context if not provided
    if (!enhanced.system) {
      enhanced.system = {
        appName: process.env.APP_NAME || 'HashLand',
        appUrl: process.env.APP_URL || 'https://hashland.com',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@hashland.com',
        timestamp: new Date().toISOString(),
      };
    }

    // Add current timestamp
    enhanced.system.timestamp = new Date().toISOString();

    return enhanced;
  }

  /**
   * Render a string template
   */
  private renderString(template: string, context: TemplateContext): string {
    try {
      const compiled = Handlebars.compile(template);
      return compiled(context);
    } catch (error) {
      this.logger.warn(`Failed to render string template: ${error.message}`);
      return template; // Return original if rendering fails
    }
  }

  /**
   * Render an object with template strings
   */
  private renderObject(obj: any, context: TemplateContext): any {
    if (typeof obj === 'string') {
      return this.renderString(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.renderObject(item, context));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.renderObject(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Extract variables from template string
   */
  private extractVariables(template: string): string[] {
    const variables: string[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      // Remove helpers and get variable name
      const variableName = variable.split(' ')[0];
      if (!variableName.startsWith('#') && !variableName.startsWith('/')) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  /**
   * Validate template structure for common issues
   */
  private validateTemplateStructure(
    template: string,
    result: TemplateValidationResult,
  ): void {
    // Check for unmatched braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      result.errors.push('Unmatched template braces');
      result.isValid = false;
    }

    // Check for empty template
    if (template.trim().length === 0) {
      result.warnings.push('Template is empty');
    }

    // Check for potential XSS (basic check)
    if (template.includes('<script') || template.includes('javascript:')) {
      result.warnings.push('Template contains potentially unsafe content');
    }
  }

  /**
   * Generate checksum for template content
   */
  private generateChecksum(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
