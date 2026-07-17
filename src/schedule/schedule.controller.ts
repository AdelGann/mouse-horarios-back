import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query, BadRequestException, ConflictException } from "@nestjs/common"
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

    // Run slots validations (times, semester, internal conflicts, room taken conflict)
    await this.validateScheduleSlots(termId, parseInt(semester), sectionId, subjects)

    // Check if a schedule already exists for this combination
    const existing = await this.prisma.schedule.findFirst({
      where: { termId, sectionId, semester: parseInt(semester) },
      include: { section: true, term: true }
    })

    if (existing) {
      throw new ConflictException(
        `Ya existe un horario para la Sección "${existing.section?.name || sectionId}" en el Semestre ${semester} dentro del lapso "${existing.term?.name || termId}". Use la opción de editar para modificarlo.`
      )
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        termId,
        sectionId,
        semester: parseInt(semester),
        isPublished: true
      }
    })

    await this.saveSubjects(schedule.id, subjects)

    const secObj = await this.prisma.section.findUnique({ where: { id: sectionId } })
    await this.auditService.logAction(
      admin.id,
      admin.username,
      "CREATE_SCHEDULE",
      `Horario creado para Sección: ${secObj?.name || "N/A"}, Semestre: ${semester}`
    )

    return { success: true, scheduleId: schedule.id }
  }

  // UPDATE GLOBAL SCHEDULE (Admin Only)
  @Put("global/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateGlobalSchedule(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const admin = req.user
    const { termId, sectionId, semester, subjects } = body
    if (!termId || !sectionId || !semester || !subjects) {
      throw new BadRequestException("Campos incompletos")
    }

    // Run slots validations (times, semester, internal conflicts, room taken conflict)
    await this.validateScheduleSlots(termId, parseInt(semester), sectionId, subjects, id)

    const schedule = await this.prisma.schedule.findUnique({ where: { id } })
    if (!schedule) throw new BadRequestException("Horario no encontrado")

    // Check conflict with OTHER schedules (not itself)
    const conflict = await this.prisma.schedule.findFirst({
      where: {
        termId,
        sectionId,
        semester: parseInt(semester),
        NOT: { id }
      },
      include: { section: true, term: true }
    })

    if (conflict) {
      throw new ConflictException(
        `Ya existe un horario para la Sección "${conflict.section?.name || sectionId}" en el Semestre ${semester} dentro del lapso "${conflict.term?.name || termId}".`
      )
    }

    // Update schedule metadata
    await this.prisma.schedule.update({
      where: { id },
      data: { termId, sectionId, semester: parseInt(semester) }
    })

    // Replace subjects
    await this.prisma.subject.deleteMany({ where: { scheduleId: id } })
    await this.saveSubjects(id, subjects)

    const secObj = await this.prisma.section.findUnique({ where: { id: sectionId } })
    await this.auditService.logAction(
      admin.id,
      admin.username,
      "UPDATE_SCHEDULE",
      `Horario actualizado para Sección: ${secObj?.name || "N/A"}, Semestre: ${semester}`
    )

    return { success: true, scheduleId: id }
  }

  // Helper: save subjects + slots for a schedule
  private async saveSubjects(scheduleId: string, subjects: any[]) {
    for (const sub of subjects) {
      const createdSubject = await this.prisma.subject.create({
        data: {
          scheduleId,
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
            schedule: {
              include: {
                section: true
              }
            },
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
              schedule: {
                include: {
                  section: true
                }
              },
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
              schedule: {
                include: {
                  section: true
                }
              },
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
            course: {
              include: { career: true }
            },
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

  private async validateScheduleSlots(termId: string, semester: number, sectionId: string, subjects: any[], excludeScheduleId?: string) {
    if (!termId) throw new BadRequestException("El lapso académico es requerido");
    if (!sectionId || sectionId.trim() === "") throw new BadRequestException("La sección es requerida");
    if (!semester || semester < 1 || semester > 10) throw new BadRequestException("El semestre debe ser un número válido entre 1 y 10");

    const localSlots: { day: number, start: number, end: number, roomId: string, courseName: string }[] = [];

    for (const sub of subjects) {
      const course = await this.prisma.course.findUnique({ where: { id: sub.courseId } });
      const courseName = course?.name || "Materia";

      if (!sub.slots || !Array.isArray(sub.slots) || sub.slots.length === 0) {
        throw new BadRequestException(`La materia ${courseName} debe tener al menos un bloque de horario.`);
      }

      for (const slot of sub.slots) {
        if (!slot.startTime || !slot.endTime) {
          throw new BadRequestException("La hora de inicio y fin son requeridas para todos los bloques.");
        }

        const [sH, sM] = slot.startTime.split(":").map(Number);
        const [eH, eM] = slot.endTime.split(":").map(Number);
        const start = sH * 60 + sM;
        const end = eH * 60 + eM;

        if (start < 8 * 60 || end > 16 * 60) {
          throw new BadRequestException(
            `El horario para la materia ${courseName} (${slot.startTime} - ${slot.endTime}) está fuera del rango permitido (08:00 AM a 04:00 PM).`
          );
        }

        if (start >= end) {
          throw new BadRequestException(
            `Horario inválido para ${courseName}: La hora de inicio (${slot.startTime}) debe ser anterior a la hora de fin (${slot.endTime}).`
          );
        }

        const dayOfWeek = parseInt(slot.dayOfWeek);
        for (const existing of localSlots) {
          if (existing.day === dayOfWeek) {
            if (start < existing.end && existing.start < end) {
              throw new ConflictException(
                `Conflicto de horario interno: Hay un solapamiento de horas el mismo día para ${courseName} y ${existing.courseName}.`
              );
            }
          }
        }

        localSlots.push({ day: dayOfWeek, start, end, roomId: slot.roomId || "", courseName });
      }
    }

    const databaseSchedules = await this.prisma.schedule.findMany({
      where: {
        termId,
        NOT: excludeScheduleId ? { id: excludeScheduleId } : undefined
      },
      include: {
        section: true,
        subjects: {
          include: {
            course: true,
            slots: {
              include: {
                room: true
              }
            }
          }
        }
      }
    });

    for (const local of localSlots) {
      if (!local.roomId) continue;

      for (const dbSched of databaseSchedules) {
        for (const dbSub of dbSched.subjects) {
          for (const dbSlot of dbSub.slots) {
            if (dbSlot.roomId === local.roomId && dbSlot.dayOfWeek === local.day) {
              const [dbHStart, dbMStart] = dbSlot.startTime.split(":").map(Number);
              const [dbHEnd, dbMEnd] = dbSlot.endTime.split(":").map(Number);
              const dbStart = dbHStart * 60 + dbMStart;
              const dbEnd = dbHEnd * 60 + dbMEnd;

              if (local.start < dbEnd && dbStart < local.end) {
                const roomName = dbSlot.room?.name || "el aula seleccionada";
                throw new ConflictException(
                  `Aula Tomada: El aula "${roomName}" ya está ocupada el día de la semana correspondiente en el horario de ${dbSlot.startTime} a ${dbSlot.endTime} por la materia "${dbSub.course?.name || "otra materia"}" de la sección "${dbSched.section?.name || "otra sección"}" (Semestre ${dbSched.semester}).`
                );
              }
            }
          }
        }
      }
    }
  }
}
