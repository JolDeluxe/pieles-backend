import { prisma } from "../src/config/database";

interface LineaConfig {
  nombre: string;
  codigo: string;
  area: "BOTA" | "ACCESORIOS";
  orden: number;
  diasTolerancia: number;
  esOficial?: boolean; // true por defecto; false si es solo histórica
}

// Catálogo oficial solicitado por el usuario:
// BOTA: BOTA (3d), BETA 7 (7d), ALTA CALIDAD (7d), LAGARTO (7d)
// ACCESORIOS: CINTOS (4d), CINTOS MAQ (7d), BILLETERAS (7d), CHAMARRAS (7d), BOLSA (7d), CHARMS (7d), PEQUEÑA MARROQUINERIA (7d)
const LINEAS_OFICIALES: LineaConfig[] = [
  // ─── BLOQUE BOTA ───
  { nombre: "BOTA", codigo: "BOTA", area: "BOTA", orden: 1, diasTolerancia: 3, esOficial: true },
  { nombre: "BETA 7", codigo: "BETA_7", area: "BOTA", orden: 2, diasTolerancia: 7, esOficial: true },
  { nombre: "ALTA CALIDAD", codigo: "ALTA_CALIDAD", area: "BOTA", orden: 3, diasTolerancia: 7, esOficial: true },
  { nombre: "LAGARTO", codigo: "LAGARTO", area: "BOTA", orden: 4, diasTolerancia: 7, esOficial: true },

  // ─── BLOQUE ACCESORIOS ───
  { nombre: "CINTOS", codigo: "CINTOS", area: "ACCESORIOS", orden: 1, diasTolerancia: 4, esOficial: true },
  { nombre: "CINTOS MAQ", codigo: "CINTOS_MAQ", area: "ACCESORIOS", orden: 2, diasTolerancia: 7, esOficial: true },
  { nombre: "BILLETERAS", codigo: "BILLETERAS", area: "ACCESORIOS", orden: 3, diasTolerancia: 7, esOficial: true },
  { nombre: "CHAMARRAS", codigo: "CHAMARRAS", area: "ACCESORIOS", orden: 4, diasTolerancia: 7, esOficial: true },
  { nombre: "BOLSA", codigo: "BOLSAS", area: "ACCESORIOS", orden: 5, diasTolerancia: 7, esOficial: true },
  { nombre: "CHARMS", codigo: "CHARMS", area: "ACCESORIOS", orden: 6, diasTolerancia: 7, esOficial: true },
  { nombre: "PEQUEÑA MARROQUINERIA", codigo: "PEQUENA_MARROQUINERIA", area: "ACCESORIOS", orden: 7, diasTolerancia: 7, esOficial: true },
];

async function seedLineas() {
  console.log("Iniciando seed de Líneas Oficiales...");

  // Buscar departamento de Materia Prima / Producción
  const depto = await prisma.departamento.findFirst({
    where: { nombre: { contains: "Materia Prima" } },
  });

  const departamentoId = depto?.id ?? 1;

  // 1. Desactivar o eliminar líneas que ya no forman parte del catálogo oficial
  const codigosOficiales = LINEAS_OFICIALES.map((l) => l.codigo);

  // Buscar líneas existentes en este depto
  const lineasExistentes = await prisma.lineaProduccion.findMany({
    where: { departamentoId },
  });

  for (const existente of lineasExistentes) {
    if (!codigosOficiales.includes(existente.codigo)) {
      // Verificar si tiene programas asociados
      const programasCount = await prisma.listadoMaterial.count({
        where: { lineaProduccionId: existente.id },
      });

      if (programasCount > 0) {
        // Si tiene programas históricos asociados, mantenerla pero INACTIVA para que no salga en catálogo activo
        await prisma.lineaProduccion.update({
          where: { id: existente.id },
          data: {
            estado: "INACTIVO",
            orden: 99,
          },
        });
        console.log(`- Línea histórica preservada como INACTIVA: ${existente.nombre} (${existente.codigo}) [${programasCount} programas]`);
      } else {
        // Si no tiene ningún programa asociado, se elimina limpiamente
        await prisma.lineaProduccion.delete({
          where: { id: existente.id },
        });
        console.log(`x Eliminada línea obsoleta sin uso: ${existente.nombre} (${existente.codigo})`);
      }
    }
  }

  // 2. Insertar / Actualizar las líneas oficiales
  for (const lin of LINEAS_OFICIALES) {
    const existing = await prisma.lineaProduccion.findFirst({
      where: {
        codigo: lin.codigo,
        departamentoId,
      },
    });

    if (existing) {
      await prisma.lineaProduccion.update({
        where: { id: existing.id },
        data: {
          nombre: lin.nombre,
          area: lin.area,
          orden: lin.orden,
          diasTolerancia: lin.diasTolerancia,
          permiteDirectos: true,
          permiteIndirectos: true,
          permiteBolsas: false,
          estado: "ACTIVO",
        },
      });
      console.log(`✓ Actualizada línea oficial: ${lin.nombre} (${lin.area}) - Orden: ${lin.orden}, Tol: ${lin.diasTolerancia}d`);
    } else {
      await prisma.lineaProduccion.create({
        data: {
          codigo: lin.codigo,
          nombre: lin.nombre,
          departamentoId,
          area: lin.area,
          orden: lin.orden,
          diasTolerancia: lin.diasTolerancia,
          permiteDirectos: true,
          permiteIndirectos: true,
          permiteBolsas: false,
          estado: "ACTIVO",
        },
      });
      console.log(`+ Creada línea oficial: ${lin.nombre} (${lin.area}) - Orden: ${lin.orden}, Tol: ${lin.diasTolerancia}d`);
    }
  }

  console.log("¡Seed de líneas oficiales completado exitosamente!");
}

seedLineas()
  .catch((err) => {
    console.error("Error en seedLineas:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
