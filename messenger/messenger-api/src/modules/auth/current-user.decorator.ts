import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Custom decorator to extract the user from the GraphQL context.
 * This works because our GqlAuthGuard/JwtStrategy attaches 
 * the user object to the request.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user; // This is the user object from JwtStrategy
  },
);