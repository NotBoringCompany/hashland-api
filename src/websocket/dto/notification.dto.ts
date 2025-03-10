import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { NotificationType } from '../notification.interface';

export class AuthenticateOperatorDto {
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  data?: any;
}

export class BroadcastNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  data?: any;
}
