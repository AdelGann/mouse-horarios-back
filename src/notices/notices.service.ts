import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  async create(title: string, content: string) {
    return this.prisma.notice.create({
      data: { title, content }
    })
  }

  async findAll() {
    return this.prisma.notice.findMany({
      orderBy: { createdAt: "desc" }
    })
  }

  async update(id: string, title: string, content: string) {
    return this.prisma.notice.update({
      where: { id },
      data: { title, content }
    })
  }

  async delete(id: string) {
    return this.prisma.notice.delete({
      where: { id }
    })
  }
}
