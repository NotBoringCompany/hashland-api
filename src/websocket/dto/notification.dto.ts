import { IsString, IsNotEmpty, IsEnum, IsOptional, ValidateNested, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../notification.interface';

export class AuthenticateUserDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    token: string;
}

export class SendNotificationDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

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