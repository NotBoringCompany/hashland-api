import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramAuthDto {
  @ApiProperty({
    description: 'Telegram login widget initialization data',
    example:
      'query_id=AAHdF6I0AgAAANwX4jQCkfR4&user={"id":12345,"first_name":"John",...}&auth_date=1623456789&hash=abc123...',
  })
  @IsString()
  @IsNotEmpty()
  initData: string;
}

export class TelegramCreds {
  @ApiProperty({
    description: 'Telegram user ID',
    example: 12345678,
  })
  id: number;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  first_name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  last_name: string;

  @ApiProperty({
    description: 'Telegram username',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'User language code',
    example: 'en',
  })
  language_code: string;

  @ApiProperty({
    description: 'Whether user allows write to PM',
    example: true,
  })
  allows_write_to_pm: boolean;
}

export class TelegramAuthData {
  @ApiProperty({
    description: 'Telegram query ID',
    example: 'AAHdF6I0AgAAANwX4jQCkfR4',
  })
  query_id: string;

  @ApiProperty({
    description: 'Telegram user credentials',
    type: () => TelegramCreds,
  })
  user: TelegramCreds;

  @ApiProperty({
    description: 'Authentication timestamp',
    example: '1623456789',
  })
  auth_date: string;

  @ApiProperty({
    description: 'Data hash for verification',
    example: 'abc123def456...',
  })
  hash: string;
}
