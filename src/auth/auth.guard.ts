import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { AuthService } from "./auth.service"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization
    if (!authHeader) {
      throw new UnauthorizedException("Acceso no autorizado. Inicie sesión.")
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await this.authService.validateToken(token)
    if (!user) {
      throw new UnauthorizedException("Token inválido o expirado.")
    }

    request.user = user
    return true
  }
}
