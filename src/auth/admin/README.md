# AdminGuard

The AdminGuard is an authentication guard that validates incoming requests using an API key in the `X-Admin-Key` header.

## Setup

1. Ensure you have an `ADMIN_API_KEY` environment variable set in your `.env` file:

```
ADMIN_API_KEY=your_secure_api_key_here
```

2. The AdminGuard is already registered in the AuthModule and can be imported where needed.

## Usage

### Option 1: Using AdminProtected decorator (Recommended)

The easiest way to protect routes is using the `@AdminProtected()` decorator which combines the guard with appropriate Swagger documentation:

```typescript
import { Controller, Get } from '@nestjs/common';
import { AdminProtected } from 'src/auth/admin';

@Controller('some-admin-route')
export class SomeAdminController {
  
  @AdminProtected()
  @Get()
  protectedAdminEndpoint() {
    // This endpoint is protected and only accessible with a valid X-Admin-Key header
    return { data: 'sensitive data' };
  }
}
```

### Option 2: Using the guard directly

Alternatively, you can use the `@UseGuards()` decorator directly:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/auth/admin';

@Controller('some-admin-route')
export class SomeAdminController {
  
  @UseGuards(AdminGuard)
  @Get()
  protectedAdminEndpoint() {
    // This endpoint is protected and only accessible with a valid X-Admin-Key header
    return { data: 'sensitive data' };
  }
}
```

## Sending Requests

When making requests to an endpoint protected by AdminGuard, include the `X-Admin-Key` header:

```
curl -X GET http://localhost:3000/some-admin-route \
  -H "X-Admin-Key: your_secure_api_key_here"
```

## Error Responses

The guard will return one of the following errors if authentication fails:

- `Server configuration error: Admin API key not configured` - The server doesn't have an ADMIN_API_KEY configured
- `Missing X-Admin-Key header` - The request doesn't include the X-Admin-Key header
- `Invalid admin key` - The provided key doesn't match the configured key 