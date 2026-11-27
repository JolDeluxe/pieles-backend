import { prisma } from "../src/config/database";
import * as fs from "fs";
import * as path from "path";

/**
 * Parsea fechas con formato dd/mm/aaaa o dd / mm / aaaa a objeto Date UTC a medianoche.
 */
function parseDateMex(str?: string | null): Date | null {
  if (!str) return null;
  const clean = str.replace(/\s+/g, "").trim();
  const parts = clean.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
  }
  return null;
}

interface ProgramaRaw {
  idKey: string;
  lineaStr: string;
  listaStr: string;
  fechaReqStr: string;
  ordenStr: string;
}

async function seedHistorico() {
  console.log("=== INICIANDO SEED HISTÓRICO DE PIELES DESDE backend/hist ===");

  const histDir = path.resolve(__dirname, "../hist");
  const c1Path = path.join(histDir, "Consulta1.txt");
  const c2Path = path.join(histDir, "Consulta2.txt");
  const c3Path = path.join(histDir, "Consulta3.txt");
  const c4Path = path.join(histDir, "Consulta4.txt");

  if (!fs.existsSync(c1Path)) {
    throw new Error(`No se encontró el archivo: ${c1Path}`);
  }

  // 1. Cargar usuario admin base y departamento
  const adminUser = await prisma.usuario.findFirst({
    where: { usuario: "admin" },
  });
  if (!adminUser) throw new Error("Usuario admin no encontrado en la base de datos.");

  const depto = await prisma.departamento.findFirst({
    where: { nombre: { contains: "Materia Prima" } },
  });
  const departamentoId = depto?.id ?? 1;

  // 2. Mapear líneas de producción existentes en BD por nombre en mayúsculas
  const lineasBD = await prisma.lineaProduccion.findMany({
    where: { departamentoId },
  });

  const lineaMap = new Map<string, number>();
  lineasBD.forEach((l) => {
    lineaMap.set(l.nombre.trim().toUpperCase(), l.id);
  });

  // Alias para coincidir nombres del sistema anterior con las líneas de BD:
  // 'BOTAS' -> 'BOTA'
  const getLineaId = (nombre: string): number => {
    const clean = nombre.trim().toUpperCase();
    if (clean === "BOTAS" && lineaMap.has("BOTA")) {
      return lineaMap.get("BOTA")!;
    }
    if (lineaMap.has(clean)) {
      return lineaMap.get(clean)!;
    }
    // Fallback BOTA
    return lineaMap.get("BOTA") ?? lineasBD[0].id;
  };

  // 3. Cargar fechas de acciones: C2 (Afectado), C3 (Regreso), C4 (Descontado)
  const cargarMapaFechas = (filePath: string): Map<string, Date> => {
    const map = new Map<string, Date>();
    if (!fs.existsSync(filePath)) return map;
    const content = fs.readFileSync(filePath, "latin1");
    const lines = content.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split("\t").map((p) => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const idKey = parts[0];
        const dateObj = parseDateMex(parts[1]);
        if (dateObj) map.set(idKey, dateObj);
      }
    }
    return map;
  };

  const c2Fechas = cargarMapaFechas(c2Path); // Entrega Afectada
  const c3Fechas = cargarMapaFechas(c3Path); // Regreso Material
  const c4Fechas = cargarMapaFechas(c4Path); // Descontado Sistema

  console.log(`Cargadas fechas: C2=${c2Fechas.size}, C3=${c3Fechas.size}, C4=${c4Fechas.size}`);

  // 4. Leer Consulta1.txt
  const c1Content = fs.readFileSync(c1Path, "latin1");
  const c1Lines = c1Content.split("\n");
  const programas: ProgramaRaw[] = [];

  for (let i = 1; i < c1Lines.length; i++) {
    const line = c1Lines[i].trim();
    if (!line) continue;
    const parts = line.split("\t").map((p) => p.trim());
    if (parts.length >= 5) {
      // No, ID, Linea, Lista, Fecha, Orden
      programas.push({
        idKey: parts[1],
        lineaStr: parts[2],
        listaStr: parts[3],
        fechaReqStr: parts[4],
        ordenStr: parts[5] || "99",
      });
    }
  }

  console.log(`Total de programas a procesar en Consulta1: ${programas.length}`);

  let insertados = 0;
  let actualizados = 0;

  for (const prog of programas) {
    const numeroListado = prog.listaStr.toUpperCase().trim();
    const lineaId = getLineaId(prog.lineaStr);
    const fechaRequerida = parseDateMex(prog.fechaReqStr) || new Date();

    const fechaAfectado = c2Fechas.get(prog.idKey) || null;
    const fechaRegreso = c3Fechas.get(prog.idKey) || null;
    const fechaDescontado = c4Fechas.get(prog.idKey) || null;

    // Determinar estado según las fechas
    let estadoListado: "PENDIENTE" | "SEPARADO" | "ENTREGADO_A_PRODUCCION" | "DESCONTADO" = "PENDIENTE";
    let estadoFrente: "PENDIENTE" | "SEPARADO" | "ENTREGADO" | "DESCONTADO" = "PENDIENTE";

    if (fechaDescontado) {
      estadoListado = "DESCONTADO";
      estadoFrente = "DESCONTADO";
    } else if (fechaRegreso) {
      estadoListado = "ENTREGADO_A_PRODUCCION";
      estadoFrente = "ENTREGADO";
    } else if (fechaAfectado) {
      estadoListado = "SEPARADO";
      estadoFrente = "SEPARADO";
    }

    const existing = await prisma.listadoMaterial.findUnique({
      where: { numeroListado },
      include: { frentes: true },
    });

    if (existing) {
      await prisma.listadoMaterial.update({
        where: { id: existing.id },
        data: {
          fechaRequerida,
          lineaProduccionId: lineaId,
          departamentoId,
          estado: estadoListado,
        },
      });

      if (existing.frentes.length > 0) {
        await prisma.listadoSurtidoFrente.update({
          where: { id: existing.frentes[0].id },
          data: {
            estado: estadoFrente,
            separadoPorId: null, // Histórico sin usuario capturado
            fechaSeparado: fechaAfectado,
            entregadoPorId: null, // Histórico sin usuario capturado
            fechaEntregado: fechaRegreso,
            descontadoPorId: null, // Histórico sin usuario capturado
            fechaDescontado,
          },
        });
      }
      actualizados++;
    } else {
      await prisma.listadoMaterial.create({
        data: {
          numeroListado,
          fechaRequerida,
          departamentoId,
          lineaProduccionId: lineaId,
          estado: estadoListado,
          creadoPorUsuarioId: adminUser.id,
          frentes: {
            create: {
              tipoFrente: "DIRECTOS",
              estado: estadoFrente,
              separadoPorId: null,
              fechaSeparado: fechaAfectado,
              entregadoPorId: null,
              fechaEntregado: fechaRegreso,
              descontadoPorId: null,
              fechaDescontado,
            },
          },
        },
      });
      insertados++;
    }
  }

  console.log(`\n¡SEED HISTÓRICO COMPLETADO EXITOSAMENTE!`);
  console.log(`- Nuevos insertados: ${insertados}`);
  console.log(`- Actualizados: ${actualizados}`);
  console.log(`- Total programas procesados: ${programas.length}`);
}

seedHistorico()
  .catch((err) => {
    console.error("Error en seedHistorico:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
