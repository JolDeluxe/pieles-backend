import { prisma } from "../src/config/database";

interface LineaConfig {
  nombre: string;
  codigo: string;
  area: "BOTA" | "ACCESORIOS";
  orden: number;
  diasTolerancia: number;
}

const LINEAS_CATALOGO: LineaConfig[] = [
  // ─── BLOQUE BOTA ───
  // Mantener las existentes en su orden actual
  { nombre: "BOTA", codigo: "BOTA", area: "BOTA", orden: 1, diasTolerancia: 5 },
  { nombre: "COMPL. BOTA", codigo: "COMPL_BOTA", area: "BOTA", orden: 2, diasTolerancia: 5 },
  { nombre: "BOTA LAG", codigo: "BOTA_LAG", area: "BOTA", orden: 3, diasTolerancia: 5 },
  { nombre: "BOTA FAC", codigo: "BOTA_FAC", area: "BOTA", orden: 4, diasTolerancia: 5 },
  { nombre: "CAJA ESPECIAL", codigo: "CAJA_ESPECIAL", area: "BOTA", orden: 5, diasTolerancia: 5 },
  // Nuevas en BOTA
  { nombre: "ALTA CALIDAD", codigo: "ALTA_CALIDAD", area: "BOTA", orden: 6, diasTolerancia: 5 },
  { nombre: "LAGARTO", codigo: "LAGARTO", area: "BOTA", orden: 7, diasTolerancia: 5 },

  // ─── BLOQUE ACCESORIOS ───
  // Mantener las existentes en su orden actual
  { nombre: "CINTOS", codigo: "CINTOS", area: "ACCESORIOS", orden: 1, diasTolerancia: 5 },
  { nombre: "CINTOS MAQ", codigo: "CINTOS_MAQ", area: "ACCESORIOS", orden: 2, diasTolerancia: 5 },
  { nombre: "BILLETERAS", codigo: "BILLETERAS", area: "ACCESORIOS", orden: 3, diasTolerancia: 5 },
  { nombre: "CHAMARRAS", codigo: "CHAMARRAS", area: "ACCESORIOS", orden: 4, diasTolerancia: 5 },
  { nombre: "BETA 7", codigo: "BETA_7", area: "ACCESORIOS", orden: 5, diasTolerancia: 5 },
  { nombre: "BOLSAS", codigo: "BOLSAS", area: "ACCESORIOS", orden: 6, diasTolerancia: 5 },
  // Nueva en ACCESORIOS
  { nombre: "CHAMRS", codigo: "CHAMRS", area: "ACCESORIOS", orden: 7, diasTolerancia: 5 },
];

async function seedLineas() {
  console.log("Iniciando seed de Líneas / Maquilas con 5 días de tolerancia...");

  // Buscar departamento de Materia Prima / Producción
  const depto = await prisma.departamento.findFirst({
    where: { nombre: { contains: "Materia Prima" } },
  });

  const departamentoId = depto?.id ?? 1;

  for (const lin of LINEAS_CATALOGO) {
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
          diasTolerancia: 5,
          permiteDirectos: true,
          permiteIndirectos: true,
          permiteBolsas: false,
          estado: "ACTIVO",
        },
      });
      console.log(`✓ Actualizada línea: ${lin.nombre} (${lin.area}) - Orden: ${lin.orden}, Tol: 5d`);
    } else {
      await prisma.lineaProduccion.create({
        data: {
          codigo: lin.codigo,
          nombre: lin.nombre,
          departamentoId,
          area: lin.area,
          orden: lin.orden,
          diasTolerancia: 5,
          permiteDirectos: true,
          permiteIndirectos: true,
          permiteBolsas: false,
          estado: "ACTIVO",
        },
      });
      console.log(`+ Creada línea: ${lin.nombre} (${lin.area}) - Orden: ${lin.orden}, Tol: 5d`);
    }
  }

  // Asegurar que cualquier otra línea existente también tenga 5 días de tolerancia
  await prisma.lineaProduccion.updateMany({
    data: {
      diasTolerancia: 5,
    },
  });

  console.log("¡Seed de líneas completado exitosamente!");
}

seedLineas()
  .catch((err) => {
    console.error("Error en seedLineas:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
