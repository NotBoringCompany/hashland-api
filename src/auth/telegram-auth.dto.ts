import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsNotEmpty()
  auth_date: string;

  @IsString()
  @IsNotEmpty()
  hash: string;
}
