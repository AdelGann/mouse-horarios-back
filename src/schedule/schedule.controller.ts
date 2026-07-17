import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, Query, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { AuthGuard } from "../auth/auth.guard"
import { RolesGuard } from "../auth/roles.guard"
import { Roles } from "../auth/roles.decorator"
import { Role } from "@prisma/client"

@Controller("schedule")
export class ScheduleController {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // TERMS (Public)
  @Get("terms")
  async getTerms() {
    let term = await this.prisma.academicTerm.findFirst()
    if (!term) {
      term = await this.prisma.academicTerm.create({
        data: { name: "Lapso Académico 2026-1" }
      })
    }
    return this.prisma.academicTerm.findMany({ orderBy: { name: "asc" } })
  }

  @Post("terms")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createTerm(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { name } = body
    if (!name) throw new BadRequestException("Nombre requerido")
    const term = await this.prisma.academicTerm.create({ data: { name } })
    await this.auditService.logAction(admin.id, admin.username, "CREATE_TERM", `Lapso académico creado: ${name}`)
    return term
  }

  // GLOBAL SCHEDULE LOADING (Admin Only)
  @Post("global")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async loadGlobalSchedule(@Req() req: any, @Body() body: any) {
    const admin = req.user
    const { termId, sectionId, semester, subjects } = body
    if (!termId || !sectionId || !semester || !subjects) {
      throw new BadRequestException("Campos incompletos")
    }

    let schedule = await this.prisma.schedule.findFirst({
      where: { termId, sectionId, semester: parseInt(semester) }
    })

    if (schedule) {
      await this.prisma.subject.deleteMany({
        where: { scheduleId: schedule.id }
      })
    } else {
      schedule = await this.prisma.schedule.create({
        data: {
          termId,
          sectionId,
          semester: parseInt(semester),
          isPublished: true
        }
      })
    }

    for (const sub of subjects) {
      const createdSubject = await this.prisma.subject.create({
        data: {
          scheduleId: schedule.id,
          courseId: sub.courseId,
          teacherId: sub.teacherId || null,
        }
      })

      if (sub.slots && Array.isArray(sub.slots)) {
        for (const slot of sub.slots) {
          await this.prisma.classSlot.create({
            data: {
              subjectId: createdSubject.id,
              dayOfWeek: parseInt(slot.dayOfWeek),
              startTime: slot.startTime,
              endTime: slot.endTime,
              roomId: slot.roomId || null,
            }
          })
        }
      }
    }

    const secObj = await this.prisma.section.findUnique({ where: { id: sectionId } })
    await this.auditService.logAction(
      admin.id,
      admin.username,
      "LOAD_SCHEDULE",
      `Horario cargado para Sección: ${secObj?.name || "N/A"}, Semestre: ${semester}`
    )

    return { success: true, scheduleId: schedule.id }
  }

  // GET GLOBAL SCHEDULES FOR PLANNER (Public)
  @Get("sections-schedules")
  async getSectionsSchedules(
    @Query("careerId") careerId: string,
    @Query("semester") semester?: string
  ) {
    if (!careerId) {
      throw new BadRequestException("ID de carrera es requerido")
    }

    const sem = semester ? parseInt(semester) : undefined

    return this.prisma.schedule.findMany({
      where: {
        semester: sem || undefined,
        subjects: {
          some: {
            course: {
              careerId: careerId
            }
          }
        }
      },
      include: {
        section: true,
        term: true,
        subjects: {
          where: {
            course: {
              careerId: careerId
            }
          },
          include: {
            course: true,
            teacher: true,
            slots: {
              include: {
                room: true
              }
            }
          }
        }
      }
    })
  }

  // USER PERSONAL SCHEDULES DRAFTS (Logged User Only)
  @Get("personal")
  @UseGuards(AuthGuard)
  async getPersonalSchedules(@Req() req: any) {
    const user = req.user
    return this.prisma.personalSchedule.findMany({
      where: { userId: user.id },
      include: {
        subjects: {
          include: {
            course: true,
            teacher: true,
            slots: {
              include: {
                room: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  }

  @Post("personal")
  @UseGuards(AuthGuard)
  async savePersonalSchedule(@Req() req: any, @Body() body: any) {
    const user = req.user
    const { id, name, subjectIds } = body
    if (!name || !subjectIds || !Array.isArray(subjectIds)) {
      throw new BadRequestException("Campos de borrador de horario incompletos")
    }

    let personalSchedule
    if (id) {
      personalSchedule = await this.prisma.personalSchedule.update({
        where: { id, userId: user.id },
        data: {
          name,
          subjects: {
            set: [],
            connect: subjectIds.map(id => ({ id }))
          }
        },
        include: {
          subjects: {
            include: {
              course: true,
              teacher: true,
              slots: {
                include: { room: true }
              }
            }
          }
        }
      })
    } else {
      personalSchedule = await this.prisma.personalSchedule.create({
        data: {
          name,
          userId: user.id,
          subjects: {
            connect: subjectIds.map(id => ({ id }))
          }
        },
        include: {
          subjects: {
            include: {
              course: true,
              teacher: true,
              slots: {
                include: { room: true }
              }
            }
          }
        }
      })
    }

    return personalSchedule
  }

  @Get("global")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAllGlobalSchedules() {
    return this.prisma.schedule.findMany({
      include: {
        section: true,
        term: true,
        subjects: {
          include: {
            course: true,
            teacher: true,
            slots: {
              include: { room: true }
            }
          }
        }
      },
      orderBy: { semester: "asc" }
    })
  }

  @Delete("global/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteGlobalSchedule(@Req() req: any, @Param("id") id: string) {
    const admin = req.user
    const subjects = await this.prisma.subject.findMany({ where: { scheduleId: id } })
    for (const sub of subjects) {
      await this.prisma.classSlot.deleteMany({ where: { subjectId: sub.id } })
    }
    await this.prisma.subject.deleteMany({ where: { scheduleId: id } })
    await this.prisma.schedule.delete({ where: { id } })
    
    await this.auditService.logAction(
      admin.id,
      admin.username,
      "DELETE_SCHEDULE",
      `Horario global eliminado ID: ${id}`
    )
    return { success: true }
  }

  @Delete("personal/:id")
  @UseGuards(AuthGuard)
  async deletePersonalSchedule(@Req() req: any, @Param("id") id: string) {
    const user = req.user
    await this.prisma.personalSchedule.delete({
      where: { id, userId: user.id }
    })
    return { success: true }
  }
}
