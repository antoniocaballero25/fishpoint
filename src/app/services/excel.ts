import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ExcelParticipantInput } from '../models/fishpoint.models';

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  async parseParticipantsFile(file: File): Promise<ExcelParticipantInput[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    const participants: ExcelParticipantInput[] = [];

    for (const row of rawRows) {
      const normalized: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        const cleanKey = key
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        normalized[cleanKey] = row[key];
      }

      const namesRaw =
        normalized['participantes'] ??
        normalized['participante'] ??
        normalized['nombres'] ??
        normalized['nombre'] ??
        normalized['pareja'] ??
        normalized['equipo'] ??
        '';

      const names = String(namesRaw).trim();
      if (!names) continue;

      const pesquilRaw = normalized['pesquil'] ?? normalized['puesto'] ?? normalized['box'] ?? '';

      const parsedPesquil =
        pesquilRaw !== '' && !isNaN(Number(pesquilRaw)) ? Number(pesquilRaw) : null;

      const zoneRaw = normalized['zona'] ?? normalized['sector'] ?? '';

      const zone = String(zoneRaw).trim() || null;

      participants.push({
        names,
        pesquil: parsedPesquil,
        zone,
      });
    }

    return participants;
  }
}
