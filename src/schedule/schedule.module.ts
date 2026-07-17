import { Module } from "@nestjs/common"
import { ScheduleController } from "./schedule.controller"
import { AuditModule } from "../audit/audit.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [ScheduleController],
})
export class ScheduleModule {}
