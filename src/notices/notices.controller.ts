import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, BadRequestException } from "@nestjs/common"
import { NoticesService } from "./notices.service"
import { AuditService } from "../audit/audit.service"
import { AuthGuard } from "../auth/auth.guard"
import { RolesGuard } from "../auth/roles.guard"
import { Roles } from "../auth/roles.decorator"
import { Role } from "@prisma/client"

@Controller("notices")
export class NoticesController {
  constructor(
    private noticesService: NoticesService,
    private auditService: AuditService
  ) {}

  @Get()
  async getNotices() {
    return this.noticesService.findAll()
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createNotice(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { title, content } = body
    if (!title || !content) {
      throw new BadRequestException("Título y contenido son requeridos")
    }
    const notice = await this.noticesService.create(title, content)
    await this.auditService.logAction(admin.id, admin.username, "CREATE_NOTICE", `Anuncio creado: ${title}`)
    return notice
  }

  @Put(":id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateNotice(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { title, content } = body
    if (!title || !content) {
      throw new BadRequestException("Título y contenido son requeridos")
    }
    const notice = await this.noticesService.update(id, title, content)
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_NOTICE", `Anuncio actualizado: ${title}`)
    return notice
  }

  @Delete(":id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteNotice(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const notice = await this.noticesService.delete(id)
    await this.auditService.logAction(admin.id, admin.username, "DELETE_NOTICE", `Anuncio eliminado: ${notice.title}`)
    return { success: true }
  }
}
