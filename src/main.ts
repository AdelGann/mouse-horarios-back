import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  })

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle("UCLA MiHorario REST API")
    .setDescription("Documentación interactiva de los endpoints del backend para el planificador de horarios estudiantiles MiHorario.")
    .setVersion("1.0")
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup("api-docs", app, document)

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`Backend server successfully listening on port ${port}`)
  console.log(`Swagger documentation available at http://localhost:${port}/api-docs`)
}
bootstrap()
