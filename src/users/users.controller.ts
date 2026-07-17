import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname, join } from "path"
import * as fs from "fs"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { AuthGuard } from "../auth/auth.guard"
import { RolesGuard } from "../auth/roles.guard"
import { Roles } from "../auth/roles.decorator"
import { Role } from "@prisma/client"

const uploadDir = "./uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

@Controller("users")
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // LIST USERS (Admin Only)
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { username: "asc" },
      include: { deanery: true },
      where: { deletedAt: null }
    })
  }

  // DELETE USER (Admin Only)
  @Delete(":id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new BadRequestException("Usuario no encontrado")
    
    await this.prisma.user.delete({ where: { id } })
    await this.auditService.logAction(admin.id, admin.username, "DELETE_USER", `Usuario eliminado: ${user.username}`)
    return { success: true }
  }

  // UPDATE CURRENT USER PROFILE (Logged User Only)
  @Put("profile")
  @UseGuards(AuthGuard)
  async updateProfile(@Req() req: any, @Body() body: any) {
    const user = req.user
    const { fullname, email, semester, img_url } = body

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullname: fullname !== undefined ? fullname : undefined,
        email: email !== undefined ? email : undefined,
        semester: semester !== undefined ? (semester ? parseInt(semester) : null) : undefined,
        img_url: img_url !== undefined ? img_url : undefined
      }
    })

    await this.auditService.logAction(
      user.id,
      user.username,
      "UPDATE_PROFILE",
      `Perfil actualizado: ${user.username}`
    )

    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      fullname: updated.fullname,
      role: updated.role,
      semester: updated.semester,
      deaneryId: updated.deaneryId,
      img_url: updated.img_url
    }
  }

  // PROFILE IMAGE UPLOAD (Logged User Only)
  @Post("upload")
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const fileExtName = extname(file.originalname)
        const randomName = Array(16)
          .fill(null)
          .map(() => Math.round(Math.random() * 16).toString(16))
          .join("")
        cb(null, `${randomName}${fileExtName}`)
      }
    })
  }))
  async uploadFile(@Req() req: any, @UploadedFile() file: any) {
    const user = req.user
    if (!file) {
      throw new BadRequestException("No se cargó ningún archivo")
    }

    const imageUrl = `/users/profile-image/${file.filename}`
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { img_url: imageUrl }
    })

    await this.auditService.logAction(
      user.id,
      user.username,
      "UPLOAD_PHOTO",
      `Foto de perfil cargada: ${file.filename}`
    )

    return { imageUrl }
  }

  // SERVE IMAGES LOCALLY (Public)
  @Get("profile-image/:filename")
  serveImage(@Param("filename") filename: string, @Res() res: any) {
    return res.sendFile(filename, { root: join(process.cwd(), uploadDir) })
  }
}
