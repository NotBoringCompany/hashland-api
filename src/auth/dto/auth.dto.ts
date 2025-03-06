import { ApiResponse } from 'src/common/dto/response.dto';
import { Operator } from 'src/operators/schemas/operator.schema';

export class AuthenticatedResponseData {
  accessToken: string;
  operator: Operator;
}

export class AuthenticatedResponse extends ApiResponse<AuthenticatedResponseData> {
  constructor(data: AuthenticatedResponseData) {
    super(200, 'Authenticated', data);
  }
}
