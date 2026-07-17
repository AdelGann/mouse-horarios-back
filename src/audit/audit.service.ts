import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAction(userId: string | null, username: string | null, action: string, details: string, ipAddress?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          username,
          action,
          details,
          ipAddress: ipAddress || null,
        },
      })
    } catch (e) {
      console.error("Failed to write audit log:", e)
    }
  }

  async getLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  }
}
