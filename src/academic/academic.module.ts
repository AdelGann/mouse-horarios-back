import { Module } from "@nestjs/common"
import { AcademicController } from "./academic.controller"
import { AuditModule } from "../audit/audit.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AcademicController],
})
export class AcademicModule {}
