import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class SyncUserReport {
  @Field()
  status!: string;

  @Field({ nullable: true })
  action?: string;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  dbUserId?: string;

  @Field({ nullable: true })
  firebaseUid?: string;
}
