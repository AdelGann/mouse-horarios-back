import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Role } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mouse-schedules?schema=public"
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding initial database data...")

  // 1. Create Deanery
  const deanery = await prisma.deanery.upsert({
    where: { id: "dcyt-id" },
    update: {},
    create: {
      id: "dcyt-id",
      name: "Decanato de Ciencias y Tecnología (DCYT)",
    },
  })
  console.log(`Created Deanery: ${deanery.name}`)

  // 2. Create Careers
  const careerInformatica = await prisma.career.upsert({
    where: { id: "career-inf" },
    update: {},
    create: {
      id: "career-inf",
      name: "Ingeniería Informática",
      deaneryId: deanery.id,
    },
  })

  const careerProduccion = await prisma.career.upsert({
    where: { id: "career-prod" },
    update: {},
    create: {
      id: "career-prod",
      name: "Ingeniería de Producción",
      deaneryId: deanery.id,
    },
  })

  const careerSistemas = await prisma.career.upsert({
    where: { id: "career-sis" },
    update: {},
    create: {
      id: "career-sis",
      name: "Licenciatura en Análisis de Sistemas",
      deaneryId: deanery.id,
    },
  })
  console.log("Created Careers")

  // 3. Create Admin User
  const passwordHash = await bcrypt.hash("admin123", 10)
  
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: { password: passwordHash },
    create: {
      username: "admin",
      email: "admin@ucla.edu.ve",
      password: passwordHash,
      fullname: "Administrador General",
      role: Role.ADMIN,
      deaneryId: deanery.id,
    },
  })
  console.log(`Created Admin User: ${adminUser.username}`)

  // 4. Create standard student user
  const studentUser = await prisma.user.upsert({
    where: { username: "estudiante" },
    update: { password: passwordHash },
    create: {
      username: "estudiante",
      email: "estudiante@ucla.edu.ve",
      password: passwordHash,
      fullname: "Carlos Gómez",
      role: Role.USER,
      semester: 3,
      deaneryId: deanery.id,
    },
  })
  console.log(`Created Student User: ${studentUser.username}`)

  // 5. Create Sections
  const sections = ["Sección 1", "Sección 2", "Sección 3"]
  const createdSections = []
  for (const secName of sections) {
    let sec = await prisma.section.findFirst({ where: { name: secName } })
    if (!sec) {
      sec = await prisma.section.create({
        data: { name: secName },
      })
    }
    createdSections.push(sec)
  }
  console.log("Created Sections")

  // 6. Create default Courses (Materias Base)
  const coursesData = [
    { name: "Matemática I", semester: 1, careerId: careerInformatica.id },
    { name: "Algoritmos", semester: 1, careerId: careerInformatica.id },
    { name: "Matemática II", semester: 2, careerId: careerInformatica.id },
    { name: "Estructura de Datos", semester: 2, careerId: careerInformatica.id },
    { name: "Cálculo I", semester: 3, careerId: careerInformatica.id },
    { name: "Programación Orientada a Objetos", semester: 3, careerId: careerInformatica.id },
    { name: "Bases de Datos I", semester: 4, careerId: careerInformatica.id },
    { name: "Sistemas Operativos", semester: 4, careerId: careerInformatica.id },
  ]

  for (const course of coursesData) {
    const existing = await prisma.course.findFirst({
      where: { name: course.name, careerId: course.careerId }
    })
    if (!existing) {
      await prisma.course.create({
        data: course,
      })
    }
  }
  console.log("Created Base Courses")

  // 7. Create Teachers
  const teachers = ["Ing. Carlos Gómez", "Prof. María Rodríguez", "Dra. Ana Martínez"]
  for (const teachName of teachers) {
    const existing = await prisma.teacher.findFirst({ where: { name: teachName } })
    if (!existing) {
      await prisma.teacher.create({
        data: { name: teachName },
      })
    }
  }
  console.log("Created Teachers")

  // 8. Create Rooms
  const rooms = [
    { name: "Aula 101 - Edif. A", capacity: 40 },
    { name: "Laboratorio 3 - Edif. B", capacity: 25 },
  ]
  for (const r of rooms) {
    const existing = await prisma.room.findFirst({ where: { name: r.name } })
    if (!existing) {
      await prisma.room.create({
        data: r,
      })
    }
  }
  console.log("Created Rooms")

  console.log("Database seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
