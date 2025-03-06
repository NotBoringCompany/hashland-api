import { IsString, IsNotEmpty } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  initData: string;
}

export class TelegramCreds {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  language_code: string;
  allows_write_to_pm: boolean;
}

export class TelegramAuthData {
  query_id: string;
  user: TelegramCreds;
  auth_date: string;
  hash: string;
}
