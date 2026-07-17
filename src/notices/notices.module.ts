import { Module } from "@nestjs/common"
import { NoticesService } from "./notices.service"
import { NoticesController } from "./notices.controller"
import { AuditModule } from "../audit/audit.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
