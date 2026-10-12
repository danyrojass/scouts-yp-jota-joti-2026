import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/auth/auth.service";
import { env, isProd } from "@/config/env";

async function main() {
  const schema = z.object({
    username: z.string().trim().min(3),
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  });
  const parsed = schema.safeParse({
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      "Faltan ADMIN_USERNAME / ADMIN_PASSWORD en el entorno, o la contrasena es muy corta."
    );
    process.exit(1);
  }
  if (isProd && parsed.data.password === "change-this-strong-password") {
    // eslint-disable-next-line no-console
    console.error("No se permite la contrasena predeterminada en produccion.");
    process.exit(1);
  }

  const { username, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, active: true },
    create: { username, passwordHash, role: "ADMIN", active: true },
  });

  // eslint-disable-next-line no-console
  console.log(`Administrador "${username}" creado/actualizado correctamente.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });