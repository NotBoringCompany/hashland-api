import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HashbearService {
  private readonly logger = new Logger(HashbearService.name);

  constructor() {}
}
