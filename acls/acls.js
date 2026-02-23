const SCENARIOS = [
  {
    id: "cenario1",
    titulo: "BRADICARDIA SINTOMÁTICA",
    observacao: "Roteiro ACLS determinístico. Referências [1], [1-2] ficam internas.",
    resumo:
      "Bradicardia instável com segunda linha, transição para PCR chocável, AESP e pós-RCE.",
    paciente: {
      apresentacao: "Paciente consciente, mas confuso no início.",
      foco: "Treino completo de resposta ACLS sem IA."
    },
    steps: [
      {
        id: "c1_s01",
        tipo: "início",
        texto_instrutor:
          "Paciente consciente, mas confuso. FC 38 bpm. PA 78/50. SpO₂ 88% em ar ambiente.",
        respostas_esperadas: [
          "Verbalizar: bradicardia sintomática instável",
          "Aplicar oxigênio suplementar (meta SpO₂ ≥ 94%)",
          "Confirmar eletrodos bem posicionados no monitor",
          "Estabelecer acesso IV periférico calibroso",
          "Identificar sinais de instabilidade"
        ],
        vitals: { fc: 38, pa: "78/50", spo2: 88, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s02"
      },
      {
        id: "c1_s02",
        tipo: "oxigenação",
        texto_instrutor:
          "Após: O₂ a 15 L/min em máscara não-reinalante. SpO₂ 96%. Paciente mantém hipotensão e confusão.",
        respostas_esperadas: [
          "Manter monitorização contínua",
          "Reavaliar perfusão e estado mental"
        ],
        vitals: { fc: 38, pa: "78/50", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s03"
      },
      {
        id: "c1_s03",
        tipo: "atropina",
        texto_instrutor:
          "Dose 1: atropina 1 mg IV em bolus, aguardar 3–5 min. Após 3 min: FC 40, PA 80/52, confuso.",
        respostas_esperadas: [
          "Administrar atropina 1 mg IV em bolus",
          "Aguardar 3–5 min",
          "Reconhecer resposta insuficiente"
        ],
        vitals: { fc: 40, pa: "80/52", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s04"
      },
      {
        id: "c1_s04",
        tipo: "atropina",
        texto_instrutor:
          "Dose 2: atropina 1 mg. Após 3 min: FC 42, PA 82/50. Sem melhora significativa.",
        respostas_esperadas: [
          "Administrar atropina 1 mg",
          "Reavaliar sinais de instabilidade"
        ],
        vitals: { fc: 42, pa: "82/50", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s05"
      },
      {
        id: "c1_s05",
        tipo: "atropina",
        texto_instrutor:
          "Dose 3: atropina 1 mg (última). Após 3 min: FC 38, PA 76/48, piora clínica.",
        respostas_esperadas: [
          "Administrar atropina 1 mg (última dose)",
          "Escalar para segunda linha imediatamente"
        ],
        vitals: { fc: 38, pa: "76/48", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s06"
      },
      {
        id: "c1_s06",
        tipo: "segunda_linha",
        texto_instrutor:
          "Escolha A: marcapasso transcutâneo (pás, 60–80 bpm, subir mA até captura, confirmar pulso, considerar sedação) OU Escolha B: dopamina 5–20 mcg/kg/min (iniciar 5 e titular).",
        respostas_esperadas: ["Definir estratégia de segunda linha (A ou B)"],
        vitals: { fc: 38, pa: "76/48", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        branch: {
          default_choice: "A",
          prompt:
            "Selecione a conduta de segunda linha. Se nada for marcado, segue a Opção A.",
          choices: [
            {
              value: "A",
              label:
                "Opção A: marcapasso transcutâneo (60–80 bpm, subir mA até captura, confirmar pulso, considerar sedação).",
              next: "c1_s07a"
            },
            {
              value: "B",
              label:
                "Opção B: dopamina 5–20 mcg/kg/min (iniciar 5 e titular).",
              next: "c1_s07b"
            }
          ]
        }
      },
      {
        id: "c1_s07a",
        tipo: "segunda_linha_a",
        texto_instrutor:
          "Opção A: marcapasso transcutâneo (pás, 60–80 bpm, subir mA até captura, confirmar pulso, considerar sedação/analgesia se consciente).",
        respostas_esperadas: [
          "Aplicar pás adesivas de marcapasso",
          "Iniciar com frequência de 60–80 bpm",
          "Aumentar corrente (mA) até obter captura",
          "Confirmar captura com palpação de pulso",
          "Considerar sedação/analgesia se paciente consciente"
        ],
        vitals: { fc: 65, pa: "86/54", spo2: 96, etco2: null, pulso: true },
        waveform: "ritmo_organizado",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s08"
      },
      {
        id: "c1_s07b",
        tipo: "segunda_linha_b",
        texto_instrutor:
          "Opção B: iniciar infusão de dopamina 5–20 mcg/kg/min (iniciar 5 e titular conforme resposta).",
        respostas_esperadas: [
          "Iniciar dopamina 5 mcg/kg/min",
          "Titular conforme resposta hemodinâmica"
        ],
        vitals: { fc: 42, pa: "82/50", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s08"
      },
      {
        id: "c1_s08",
        tipo: "pcr_chocável",
        texto_instrutor:
          "Instrutor: perdeu a consciência. Monitor: taquicardia ventricular monomórfica. Sem pulso carotídeo. Entrar em algoritmo chocável: iniciar RCP de alta qualidade, delegar funções, preparar desfibrilador (200 J bifásico).",
        respostas_esperadas: [
          "Reconhecer TV sem pulso (ritmo chocável)",
          "Iniciar RCP de alta qualidade imediatamente",
          "Delegar funções da equipe",
          "Carregar desfibrilador (200 J bifásico)"
        ],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 12, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s09"
      },
      {
        id: "c1_s09",
        tipo: "choque",
        texto_instrutor:
          "Choque 1: análise rápida (pausa <10s), choque, retomar RCP imediatamente. Via aérea: 30:2 até via aérea avançada. Após IOT: compressões contínuas + ventilações 10/min. ETCO₂ inicial 12 mmHg.",
        respostas_esperadas: [
          "Realizar choque 1",
          "Retomar RCP imediatamente após o choque",
          "Manter 30:2 até via aérea avançada",
          "Após IOT: compressões contínuas + 10 ventilações/min"
        ],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 12, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s10"
      },
      {
        id: "c1_s10",
        tipo: "análise",
        texto_instrutor:
          "Análise 2 min: TV sem pulso. Choque 2 + epinefrina 1 mg IV/IO.",
        respostas_esperadas: ["Realizar choque 2", "Administrar epinefrina 1 mg IV/IO"],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 18, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s11"
      },
      {
        id: "c1_s11",
        tipo: "análise",
        texto_instrutor:
          "Análise 4 min: TV sem pulso. Choque 3 + amiodarona 300 mg IV/IO em bolus + troca de compressor.",
        respostas_esperadas: [
          "Realizar choque 3",
          "Administrar amiodarona 300 mg IV/IO",
          "Trocar compressor"
        ],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 22, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s12"
      },
      {
        id: "c1_s12",
        tipo: "análise",
        texto_instrutor:
          "Análise 6 min: TV sem pulso. Choque 4 + epinefrina 1 mg IV/IO (intervalo 3–5 min).",
        respostas_esperadas: ["Realizar choque 4", "Administrar epinefrina 1 mg IV/IO"],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 24, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s13"
      },
      {
        id: "c1_s13",
        tipo: "aesp",
        texto_instrutor:
          "Análise 8 min: ritmo organizado ~70, SEM pulso ⇒ AESP. Retomar RCP (sem choque). Investigar Hs e Ts. Epinefrina (3ª dose) no timing adequado. Análise 10 min: AESP persiste.",
        respostas_esperadas: [
          "Reconhecer AESP",
          "Retomar RCP sem choque",
          "Investigar e tratar Hs e Ts",
          "Administrar epinefrina (3ª dose) no intervalo correto"
        ],
        vitals: { fc: 70, pa: "0/0", spo2: "-", etco2: 28, pulso: false },
        waveform: "ritmo_organizado",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_ritmo_organizado.png",
        next: "c1_s14"
      },
      {
        id: "c1_s14",
        tipo: "rce",
        texto_instrutor:
          "Análise 12 min: movimento espontâneo, ETCO₂ 42 mmHg, pulso presente ⇒ RCE.",
        respostas_esperadas: ["Reconhecer retorno da circulação espontânea (RCE)"],
        vitals: { fc: 85, pa: "88/55", spo2: 94, etco2: 42, pulso: true },
        waveform: "ritmo_organizado",
        evento: "RCE",
        ecg_image: "/assets/ecg/cenario1_ritmo_organizado.png",
        next: "c1_s15"
      },
      {
        id: "c1_s15",
        tipo: "pós_rce",
        texto_instrutor:
          "Pós-RCE: monitorização completa (meta PAS ≥ 90, SpO₂ 92–98, ETCO₂ 35–45, ECG 12 derivações). Ventilação: FR 10/min, evitar hiperventilação, titular FiO₂. Exames: gasometria, hemograma, eletrólitos, função renal, troponina, lactato e glicemia.",
        respostas_esperadas: [
          "Monitorização completa",
          "Meta PAS ≥ 90",
          "Meta SpO₂ 92–98",
          "Meta ETCO₂ 35–45",
          "FR 10/min sem hiperventilação",
          "Solicitar gasometria, hemograma, eletrólitos, função renal, troponina, lactato e glicemia"
        ],
        vitals: { fc: 84, pa: "90/58", spo2: 96, etco2: 40, pulso: true },
        waveform: "ritmo_organizado",
        ecg_image: "/assets/ecg/cenario1_ritmo_organizado.png",
        next: "c1_s16"
      },
      {
        id: "c1_s16",
        tipo: "pós_rce",
        texto_instrutor:
          "Neurológico: comatoso, indicar controle de temperatura (32°C a 37,5°C) por no mínimo 36 h; evitar hipertermia; reaquecer ≤ 0,5°C/h. Investigar causa: ECG 12D, IAMCSST ⇒ cateterismo emergente; se não, estratégia seletiva/tardia; RX de tórax; TC de crânio se indicado.",
        respostas_esperadas: [
          "Controle de temperatura 32°C a 37,5°C por no mínimo 36 h",
          "Evitar hipertermia",
          "Reaquecer ≤ 0,5°C/h",
          "Investigar causa com ECG 12D, estratégia coronariana, RX de tórax e TC de crânio se indicado"
        ],
        vitals: { fc: 84, pa: "94/62", spo2: 96, etco2: 37, pulso: true },
        waveform: "ritmo_organizado",
        ecg_image: null,
        next: "c1_s17"
      },
      {
        id: "c1_s17",
        tipo: "pós_rce",
        texto_instrutor:
          "Hemodinâmica: PA 88/55 ⇒ norepinefrina para PAS ≥ 90. Prognóstico: evitar prognosticação <72 h; considerar EEG; transferir para UTI.",
        respostas_esperadas: [
          "Iniciar norepinefrina para PAS ≥ 90",
          "Evitar prognosticação <72 h",
          "Considerar EEG",
          "Transferir para UTI"
        ],
        vitals: { fc: 85, pa: "96/62", spo2: 95, etco2: 36, pulso: true },
        waveform: "ritmo_organizado",
        evento: "Fim do cenário",
        ecg_image: null,
        next: null
      }
    ]
  }
];
