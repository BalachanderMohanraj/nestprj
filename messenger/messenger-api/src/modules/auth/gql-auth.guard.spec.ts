import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';

describe('GqlAuthGuard (unit)', () => {
  let guard: GqlAuthGuard;

  beforeEach(() => {
    guard = new GqlAuthGuard();
    jest.restoreAllMocks(); // restore spies after each test
  });

  it('should return req from GraphQL context', () => {
    const req = { headers: { authorization: 'Bearer token' } };

    // Mock what GqlExecutionContext.create(context) returns
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as any);

    const context = {} as ExecutionContext;

    const result = guard.getRequest(context);

    expect(GqlExecutionContext.create).toHaveBeenCalledWith(context);
    expect(result).toBe(req);
  });
});
