import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Role } from "@prisma/client"
import { ROLES_KEY } from "./roles.decorator"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user) {
      throw new ForbiddenException("Falta autenticación de usuario.")
    }

    const hasRole = requiredRoles.includes(user.role)
    if (!hasRole) {
      throw new ForbiddenException("No tiene permisos suficientes para esta acción.")
    }
    return true
  }
}
