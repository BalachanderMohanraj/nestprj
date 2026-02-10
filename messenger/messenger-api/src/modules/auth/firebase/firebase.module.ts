import { Module } from '@nestjs/common';
import { firebaseAdminProvider } from './firebase-admin.provider';

@Module({
  providers: [firebaseAdminProvider],
  exports: [firebaseAdminProvider],
})
export class FirebaseModule {}
// exports: [firebaseAdminProvider]