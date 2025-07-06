import { PartialType } from '@nestjs/swagger';
import { CreateNotificationTemplateDto } from './create-notification-template.dto';

/**
 * DTO for updating notification templates
 */
export class UpdateNotificationTemplateDto extends PartialType(
  CreateNotificationTemplateDto,
) {}
