import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcryptjs"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService
  ) {}

  async register(body: any, ipAddress?: string) {
    const { username, email, password, fullname, semester, deaneryId } = body
    if (!username || !email || !password || !deaneryId) {
      throw new BadRequestException("Missing required fields")
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    })
    if (existingUser) {
      throw new BadRequestException("El nombre de usuario o correo ya está registrado")
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: passwordHash,
        fullname,
        semester: semester ? parseInt(semester) : null,
        deaneryId,
      },
    })

    await this.auditService.logAction(
      user.id,
      user.username,
      "REGISTER",
      `Estudiante registrado: ${user.username}`,
      ipAddress
    )

    return this.loginSession(user)
  }

  async login(body: any, ipAddress?: string) {
    const { identifier, password } = body
    if (!identifier || !password) {
      throw new BadRequestException("Usuario y contraseña son requeridos")
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    })
    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas")
    }

    const matches = await bcrypt.compare(password, user.password)
    if (!matches) {
      throw new UnauthorizedException("Credenciales inválidas")
    }

    await this.auditService.logAction(
      user.id,
      user.username,
      "LOGIN",
      `Usuario inició sesión: ${user.username}`,
      ipAddress
    )

    return this.loginSession(user)
  }

  private loginSession(user: any) {
    const payload = { sub: user.id, username: user.username, role: user.role }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        semester: user.semester,
        deaneryId: user.deaneryId,
        img_url: user.img_url,
      },
    }
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })
      if (!user) return null
      return user
    } catch (_) {
      return null
    }
  }
}
