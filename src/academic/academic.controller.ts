import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query, BadRequestException } from "@nestjs/common"
import { Request } from "express"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { AuthGuard } from "../auth/auth.guard"
import { RolesGuard } from "../auth/roles.guard"
import { Roles } from "../auth/roles.decorator"
import { Role } from "@prisma/client"

@Controller("academic")
export class AcademicController {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // DEANERIES (Public / Student Viewable)
  @Get("deaneries")
  async getDeaneries() {
    return this.prisma.deanery.findMany({
      orderBy: { name: "asc" }
    })
  }

  @Post("deaneries")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createDeanery(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name } = body
    if (!name) throw new BadRequestException("Nombre es requerido")
    const deanery = await this.prisma.deanery.create({ data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_DEANERY", `Decanato creado: ${name}`)
    return deanery
  }

  // CAREERS (Public / Student Viewable)
  @Get("careers")
  async getCareers(@Query("deaneryId") deaneryId?: string) {
    return this.prisma.career.findMany({
      where: deaneryId ? { deaneryId } : {},
      orderBy: { name: "asc" },
      include: { deanery: true }
    })
  }

  @Post("careers")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createCareer(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name, deaneryId } = body
    if (!name || !deaneryId) throw new BadRequestException("Nombre y Decanato son requeridos")
    const career = await this.prisma.career.create({ data: { name, deaneryId } })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_CAREER", `Carrera creada: ${name}`)
    return career
  }

  // COURSES (Public / Student Viewable)
  @Get("courses")
  async getCourses(@Query("careerId") careerId?: string, @Query("semester") semester?: string) {
    const sem = semester ? parseInt(semester) : undefined
    return this.prisma.course.findMany({
      where: {
        careerId: careerId || undefined,
        semester: sem || undefined,
      },
      orderBy: [{ semester: "asc" }, { name: "asc" }],
      include: { career: true }
    })
  }

  @Post("courses")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createCourse(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name, semester, careerId } = body
    if (!name || !semester || !careerId) throw new BadRequestException("Campos incompletos")
    const course = await this.prisma.course.create({
      data: { name, semester: parseInt(semester), careerId }
    })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_COURSE", `Materia creada: ${name}`)
    return course
  }

  @Delete("courses/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteCourse(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const course = await this.prisma.course.delete({ where: { id } })
    await this.auditService.logAction(admin.id, admin.username, "DELETE_COURSE", `Materia eliminada: ${course.name}`)
    return { success: true }
  }

  // SECTIONS (Public)
  @Get("sections")
  async getSections() {
    return this.prisma.section.findMany({ orderBy: { name: "asc" } })
  }

  @Post("sections")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createSection(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name } = body
    if (!name) throw new BadRequestException("Nombre requerido")
    const section = await this.prisma.section.create({ data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_SECTION", `Sección creada: ${name}`)
    return section
  }

  @Delete("sections/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteSection(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const sec = await this.prisma.section.delete({ where: { id } })
    await this.auditService.logAction(admin.id, admin.username, "DELETE_SECTION", `Sección eliminada: ${sec.name}`)
    return { success: true }
  }

  // TEACHERS (Public)
  @Get("teachers")
  async getTeachers() {
    return this.prisma.teacher.findMany({ orderBy: { name: "asc" } })
  }

  @Post("teachers")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createTeacher(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name } = body
    if (!name) throw new BadRequestException("Nombre requerido")
    const teacher = await this.prisma.teacher.create({ data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_TEACHER", `Profesor creado: ${name}`)
    return teacher
  }

  @Delete("teachers/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteTeacher(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const teacher = await this.prisma.teacher.delete({ where: { id } })
    await this.auditService.logAction(admin.id, admin.username, "DELETE_TEACHER", `Profesor eliminado: ${teacher.name}`)
    return { success: true }
  }

  // ROOMS (Public)
  @Get("rooms")
  async getRooms() {
    return this.prisma.room.findMany({ orderBy: { name: "asc" } })
  }

  @Post("rooms")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createRoom(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name, capacity } = body
    if (!name) throw new BadRequestException("Nombre requerido")
    const room = await this.prisma.room.create({
      data: { name, capacity: capacity ? parseInt(capacity) : null }
    })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_ROOM", `Aula creada: ${name}`)
    return room
  }

  @Delete("rooms/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteRoom(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const room = await this.prisma.room.delete({ where: { id } })
    await this.auditService.logAction(admin.id, admin.username, "DELETE_ROOM", `Aula eliminada: ${room.name}`)
    return { success: true }
  }

  @Put("deaneries/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateDeanery(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { name } = body
    const res = await this.prisma.deanery.update({ where: { id }, data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_DEANERY", `Decanato actualizado: ${name}`)
    return res
  }

  @Put("careers/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateCareer(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { name, deaneryId } = body
    const res = await this.prisma.career.update({ where: { id }, data: { name, deaneryId } })
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_CAREER", `Carrera actualizada: ${name}`)
    return res
  }

  @Put("courses/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateCourse(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { name, semester, careerId } = body
    const res = await this.prisma.course.update({
      where: { id },
      data: { name, semester: parseInt(semester), careerId }
    })
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_COURSE", `Materia actualizada: ${name}`)
    return res
  }

  @Put("teachers/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateTeacher(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { name } = body
    const res = await this.prisma.teacher.update({ where: { id }, data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_TEACHER", `Profesor actualizado: ${name}`)
    return res
  }

  @Put("sections/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateSection(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { name } = body
    const res = await this.prisma.section.update({ where: { id }, data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_SECTION", `Sección actualizada: ${name}`)
    return res
  }

  @Put("rooms/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateRoom(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { name, capacity } = body
    const res = await this.prisma.room.update({
      where: { id },
      data: { name, capacity: capacity ? parseInt(capacity) : null }
    })
    await this.auditService.logAction(admin.id, admin.username, "UPDATE_ROOM", `Aula actualizada: ${name}`)
    return res
  }

  // ADMIN AUDIT LOGS (Admin Only)
  @Get("logs")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getLogs() {
    return this.auditService.getLogs()
  }
}
