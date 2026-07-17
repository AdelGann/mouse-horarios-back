import { Controller, Post, Body, Req, Headers, UnauthorizedException, Get } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { Request } from "express"

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  async register(@Body() body: any, @Req() req: Request) {
    const ip = req.ip
    return this.authService.register(body, ip)
  }

  @Post("login")
  async login(@Body() body: any, @Req() req: Request) {
    const ip = req.ip
    return this.authService.login(body, ip)
  }

  @Get("profile")
  async getProfile(@Headers("authorization") authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException("Acceso no autorizado")
    }
    const token = authHeader.replace("Bearer ", "")
    const user = await this.authService.validateToken(token)
    if (!user) {
      throw new UnauthorizedException("Token inválido o expirado")
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      semester: user.semester,
      deaneryId: user.deaneryId,
      img_url: user.img_url,
    }
  }
}
