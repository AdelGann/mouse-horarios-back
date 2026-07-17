import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { AuditModule } from "../audit/audit.module"
import { AuthGuard } from "./auth.guard"
import { RolesGuard } from "./roles.guard"

@Module({
  imports: [
    AuditModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "ucla-super-secret-key-2026",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthService, AuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
