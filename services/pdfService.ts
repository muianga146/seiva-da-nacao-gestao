import { Transaction } from "../types";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interface for Image Data with dimensions
interface ProcessedImage {
    data: string;
    width: number;
    height: number;
    ratio: number;
}

// Helper to convert image URL to Base64 and get dimensions
// Enhanced with double proxy fallback for CORS handling
const getImageData = async (url: string): Promise<ProcessedImage> => {
  const fetchImage = async (fetchUrl: string) => {
      const response = await fetch(fetchUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.blob();
  };

  const processBlob = (blob: Blob): Promise<ProcessedImage> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const img = new Image();
          img.src = base64;
          img.onload = () => {
              resolve({
                  data: base64,
                  width: img.width,
                  height: img.height,
                  ratio: img.width / img.height
              });
          };
          img.onerror = () => reject(new Error("Failed to load image for dimensions"));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
  };

  try {
    // 1. Try Direct Fetch
    const blob = await fetchImage(url);
    return await processBlob(blob);
  } catch (directError) {
    console.warn("Direct image fetch failed, trying proxy 1...");
    try {
        // 2. Try AllOrigins Proxy
        const proxyUrl1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const blob1 = await fetchImage(proxyUrl1);
        return await processBlob(blob1);
    } catch (proxyError1) {
        console.warn("Proxy 1 failed, trying proxy 2...");
        try {
            // 3. Try CorsProxy.io
            const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const blob2 = await fetchImage(proxyUrl2);
            return await processBlob(blob2);
        } catch (proxyError2) {
            console.error("All image fetch attempts failed.");
            throw new Error("Could not load image via any method.");
        }
    }
  }
};

// URL padrão do Logotipo (Seiva da Nação) - Google Drive Direct Link
const DEFAULT_LOGO_URL = "https://drive.google.com/uc?export=view&id=1-EoFPUZzWgms4VoE5uoYXBwOphg8Fz1J";

export const generateReceipt = async (transaction: Transaction, customLogoUrl?: string): Promise<string> => {
  
  // 1. Orientação: Landscape (Paisagem) - Duas vias
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // --- CONFIGURAÇÃO ---
  const primaryColor: [number, number, number] = [19, 236, 128]; // #13ec80
  const darkColor: [number, number, number] = [16, 34, 25]; // #102219
  
  // Dimensões A4 Paisagem: 297mm x 210mm
  const pageWidth = doc.internal.pageSize.width; // 297
  const pageHeight = doc.internal.pageSize.height; // 210
  const halfWidth = pageWidth / 2; // ~148.5

  // --- CARREGAMENTO DO LOGO ---
  const logoUrl = customLogoUrl && customLogoUrl.trim() !== "" ? customLogoUrl : DEFAULT_LOGO_URL;
  let logoData: ProcessedImage | null = null;
  
  try {
      logoData = await getImageData(logoUrl);
  } catch (e) {
      console.log("Falha ao carregar imagem, usando fallback.");
  }

  // --- FUNÇÃO PARA DESENHAR UMA VIA (LADO) ---
  const drawReceiptSide = (offsetX: number, title: string) => {
      const margin = 10;
      const contentWidth = halfWidth - (margin * 2);
      let cursorY = 10;

      // Título da Via (Instituição vs Encarregado)
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text(title, offsetX + halfWidth / 2, cursorY, { align: "center" });
      cursorY += 5;

      // --- LOGOTIPO (ESCALONADO E CENTRALIZADO) ---
      const logoBoxSize = 30; // 30mm x 30mm box
      const logoX = offsetX + margin;
      const logoY = cursorY;

      if (logoData) {
        try {
            let w = logoBoxSize;
            let h = logoBoxSize;

            // Lógica de Escalonamento (Manter Aspect Ratio)
            if (logoData.ratio > 1) {
                // Imagem larga (Landscape)
                w = logoBoxSize;
                h = logoBoxSize / logoData.ratio;
            } else {
                // Imagem alta (Portrait) ou Quadrada
                h = logoBoxSize;
                w = logoBoxSize * logoData.ratio;
            }

            // Lógica de Centralização dentro do Box
            const centeredX = logoX + (logoBoxSize - w) / 2;
            const centeredY = logoY + (logoBoxSize - h) / 2;

            doc.addImage(logoData.data, 'PNG', centeredX, centeredY, w, h);
        } catch (err) {
             drawFallbackLogo(logoX, logoY);
        }
      } else {
         drawFallbackLogo(logoX, logoY);
      }

      // Função auxiliar para logo fallback
      function drawFallbackLogo(x: number, y: number) {
         doc.setFillColor(200, 255, 200);
         doc.roundedRect(x, y, 30, 30, 3, 3, 'F');
         doc.setFontSize(14);
         doc.setTextColor(...primaryColor);
         doc.setFont("helvetica", "bold");
         doc.text("SN", x + 15, y + 15, { align: 'center', baseline: 'middle' });
      }

      // Cabeçalho de Texto (Ao lado do Logo)
      const textStartX = offsetX + margin + 35; // 10 (margem) + 30 (logo) + 5 (espaço)
      
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("ESCOLA SEIVA DA NAÇÃO", textStartX, cursorY + 6);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      
      // Endereço e Contatos Atualizados
      doc.text("Av. Samora Machel, Bairro de Mussumbuluco", textStartX, cursorY + 11);
      doc.text("No 90/1/A e 90/1/C | Matola - Moçambique", textStartX, cursorY + 15);
      doc.text("Cell: 842 696 623 / 877 236 290", textStartX, cursorY + 19);
      doc.text("NUIT: 401 932 712", textStartX, cursorY + 23);

      cursorY += 35; // Espaço reservado para o cabeçalho

      // Linha Divisória
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(offsetX + margin, cursorY, offsetX + halfWidth - margin, cursorY);
      cursorY += 8;

      // Título do Documento
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("RECIBO DE PAGAMENTO", offsetX + halfWidth / 2, cursorY, { align: "center" });
      cursorY += 8;

      // Informações Meta (Data, ID)
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      
      // Data com Fuso Horário de Moçambique
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', { timeZone: 'Africa/Maputo' }) + ' ' + now.toLocaleTimeString('pt-BR', { timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit' });
      
      doc.text(`Emissão: ${dateStr}`, offsetX + halfWidth - margin, cursorY, { align: "right" });
      doc.text(`Ref: #${transaction.id}`, offsetX + margin, cursorY, { align: "left" });
      
      cursorY += 5;

      // --- DATA DO PAGAMENTO ---
      // Fix date format manually to avoid timezone shifts
      const paymentDate = transaction.date.split('-').reverse().join('/');
      doc.text(`Data Pagamento: ${paymentDate}`, offsetX + margin, cursorY, { align: "left" });
      
      cursorY += 5;

      // INFO ALUNO (SE HOUVER)
      if (transaction.student_name) {
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(offsetX + margin, cursorY, contentWidth, 8, 1, 1, 'F');
          
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          doc.text("Aluno(a):", offsetX + margin + 2, cursorY + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...darkColor);
          doc.text(transaction.student_name, offsetX + margin + 18, cursorY + 5);
          
          cursorY += 10;
      }

      // --- TABELA DE DADOS ---
      const tableColumn = ["Descrição", "Forma Pagto", "Tipo", "Valor (MZN)"];
      
      const BASE_TUITION_VALUE = 2310;
      let tableRows = [];

      // LÓGICA DE MULTA: Se for mensalidade (7.2) e valor maior que o base
      if (transaction.account_code === '7.2' && transaction.amount > BASE_TUITION_VALUE) {
          const penalty = transaction.amount - BASE_TUITION_VALUE;
          tableRows = [
            [
              transaction.description + " (Valor Base)",
              transaction.paymentMethod || "N/A",
              transaction.type,
              BASE_TUITION_VALUE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            ],
            [
              "Multa por Atraso (25%)",
              "-",
              "Multa",
              penalty.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            ]
          ];
      } else {
          // Normal
          tableRows = [
            [
              transaction.description,
              transaction.paymentMethod || "N/A",
              transaction.type,
              transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            ]
          ];
      }

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: cursorY,
        margin: { left: offsetX + margin, right: pageWidth - (offsetX + halfWidth) + margin },
        tableWidth: contentWidth,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 'auto' }, 
          3: { fontStyle: 'bold', halign: 'right' } 
        },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        }
      });

      // Posição após a tabela
      cursorY = (doc as any).lastAutoTable.finalY + 15;

      // Total Destacado
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text(`Total Pago: MZN ${transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, offsetX + halfWidth - margin, cursorY, { align: "right" });
      
      cursorY += 25;

      // Assinatura
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);
      doc.line(offsetX + halfWidth / 2 - 30, cursorY, offsetX + halfWidth / 2 + 30, cursorY);

      cursorY += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Tesouraria / Carimbo Digital", offsetX + halfWidth / 2, cursorY, { align: "center" });

      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "bold italic");
      doc.text("Obrigado por fazer parte da família Seiva da Nação!", offsetX + halfWidth / 2, pageHeight - 10, { align: "center" });
  };

  // Desenha Lado Esquerdo
  drawReceiptSide(0, "Via da Instituição");

  // Desenha Lado Direito
  drawReceiptSide(halfWidth, "Via do Encarregado");

  // --- LINHA DE CORTE (Pontilhada no meio) ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0); // Pontilhado
  doc.line(halfWidth, 10, halfWidth, pageHeight - 10);

  return doc.output("bloburl");
};

// --- GERAÇÃO DE RELATÓRIO MENSAL (EXTRATO) ---
export const generateMonthlyReport = async (transactions: Transaction[], month: number, year: number, customLogoUrl?: string): Promise<string> => {
    
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
  
    const primaryColor: [number, number, number] = [19, 236, 128]; 
    const darkColor: [number, number, number] = [16, 34, 25];
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // --- CARREGAMENTO DO LOGO ---
    const logoUrl = customLogoUrl && customLogoUrl.trim() !== "" ? customLogoUrl : DEFAULT_LOGO_URL;
    let logoData: ProcessedImage | null = null;
    try { logoData = await getImageData(logoUrl); } catch (e) {}
  
    // --- CABEÇALHO ---
    let cursorY = 20;
    const margin = 15;
  
    // Desenha o logo ou o fallback (Centralizado e Scaled)
    const logoBoxSize = 25;
    if (logoData) {
      try {
          let w = logoBoxSize;
          let h = logoBoxSize;
          if (logoData.ratio > 1) { w = logoBoxSize; h = logoBoxSize / logoData.ratio; } 
          else { h = logoBoxSize; w = logoBoxSize * logoData.ratio; }
          const centeredX = margin + (logoBoxSize - w) / 2;
          const centeredY = (cursorY - 5) + (logoBoxSize - h) / 2;
          doc.addImage(logoData.data, 'PNG', centeredX, centeredY, w, h);
      } catch (err) {
          drawFallbackReportLogo(margin, cursorY);
      }
    } else {
        drawFallbackReportLogo(margin, cursorY);
    }

    function drawFallbackReportLogo(x: number, y: number) {
        doc.setFillColor(...primaryColor);
        doc.roundedRect(x, y - 5, 25, 25, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text("SN", x + 12.5, y + 7.5, { align: 'center', baseline: 'middle' });
    }
  
    // Título do Relatório
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...darkColor);
    doc.text("EXTRATO MENSAL", pageWidth - margin, cursorY + 5, { align: "right" });
    
    // Detalhes do Período
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const monthName = new Date(year, month).toLocaleString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    doc.text(`Período: ${capitalizedMonth} / ${year}`, pageWidth - margin, cursorY + 12, { align: "right" });
    
    // Data de Geração (Fuso Horário MOZ)
    const now = new Date();
    const genDate = now.toLocaleDateString('pt-BR', { timeZone: 'Africa/Maputo' });
    doc.text(`Gerado em: ${genDate}`, pageWidth - margin, cursorY + 17, { align: "right" });
  
    // Dados da Escola (Ao lado do logo)
    doc.setFontSize(12);
    doc.setTextColor(...darkColor);
    doc.setFont("helvetica", "bold");
    doc.text("ESCOLA SEIVA DA NAÇÃO", margin + 30, cursorY);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    // Endereço e Contatos Atualizados (Relatório)
    doc.text("Av. Samora Machel, Bairro de Mussumbuluco", margin + 30, cursorY + 5);
    doc.text("No 90/1/A e 90/1/C | Matola - Moçambique", margin + 30, cursorY + 9);
    doc.text("Cell: 842 696 623 / 877 236 290 | NUIT: 401 932 712", margin + 30, cursorY + 13);
  
    cursorY += 35;
  
    // --- CAIXAS DE RESUMO (Entradas, Saídas, Saldo) ---
    const totalIncome = transactions.filter(t => t.category === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions.filter(t => t.category === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalIncome - totalExpense;
  
    const boxWidth = (pageWidth - (margin * 2) - 10) / 3;
    const boxHeight = 25;
  
    // Caixa Receitas
    doc.setFillColor(240, 253, 244); // Verde claro
    doc.setDrawColor(20, 200, 100);
    doc.roundedRect(margin, cursorY, boxWidth, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(20, 150, 80);
    doc.text("TOTAL RECEITAS", margin + 5, cursorY + 8);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`+ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 5, cursorY + 18);
  
    // Caixa Despesas
    doc.setFillColor(254, 242, 242); // Vermelho claro
    doc.setDrawColor(240, 80, 80);
    doc.roundedRect(margin + boxWidth + 5, cursorY, boxWidth, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(200, 50, 50);
    doc.text("TOTAL DESPESAS", margin + boxWidth + 10, cursorY + 8);
    doc.setFontSize(12);
    doc.text(`- ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + boxWidth + 10, cursorY + 18);
  
    // Caixa Saldo
    doc.setFillColor(248, 250, 252); // Cinza claro
    doc.setDrawColor(150, 150, 150);
    doc.roundedRect(margin + (boxWidth * 2) + 10, cursorY, boxWidth, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("SALDO DO PERÍODO", margin + (boxWidth * 2) + 15, cursorY + 8);
    doc.setFontSize(12);
    doc.setTextColor(balance >= 0 ? 20 : 200, balance >= 0 ? 150 : 50, balance >= 0 ? 80 : 50);
    doc.text(`${balance >= 0 ? '+' : ''} ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + (boxWidth * 2) + 15, cursorY + 18);
  
    cursorY += 35;
  
    // --- TABELA DE TRANSAÇÕES ---
    const tableColumn = ["Data", "Descrição", "Conta (PGC)", "Forma Pagto", "Valor (MZN)"];
    
    // Ordenar por data (String Compare Safe for ISO)
    const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  
    const tableRows = sortedTransactions.map(t => [
      t.date.split('-').reverse().join('/'), // Manual formatting DD/MM/YYYY
      t.student_name ? `${t.description} (Aluno: ${t.student_name})` : t.description, // Include student in report
      t.account_code ? `${t.account_code}` : t.type, // Código PGC
      t.paymentMethod || '-',
      { 
        content: (t.category === 'expense' ? '- ' : '+ ') + t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        styles: { 
            textColor: t.category === 'expense' ? [220, 50, 50] : [20, 180, 80],
            fontStyle: 'bold',
            halign: 'right'
        }
      }
    ]);
  
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: cursorY,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [...darkColor], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' }, 
        2: { cellWidth: 30 },     // Conta PGC
        3: { cellWidth: 25 },     // Forma Pagto
        4: { cellWidth: 35, halign: 'right' }
      }
    });
  
    // --- RODAPÉ ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text("Sistema Seiva da Nação - Documento gerado eletronicamente", pageWidth / 2, pageHeight - 6, { align: 'center' });
    }
  
    return doc.output("bloburl");
};