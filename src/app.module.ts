import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { AcademicModule } from "./academic/academic.module";
import { ScheduleModule } from "./schedule/schedule.module";
import { UsersModule } from "./users/users.module";
import { NoticesModule } from "./notices/notices.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    AcademicModule,
    ScheduleModule,
    UsersModule,
    NoticesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
