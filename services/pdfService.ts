import { Transaction } from "../types";

declare global {
  interface Window {
    jspdf: any;
  }
}

// Helper to convert image URL to Base64 using fetch (CORS friendly)
const getBase64ImageFromURL = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao carregar imagem (CORS ou URL inválida):", error);
    return ""; // Retorna vazio para usar o fallback
  }
};

export const generateReceipt = async (transaction: Transaction, customLogoUrl?: string): Promise<string> => {
  if (!window.jspdf) {
    console.error("jsPDF not loaded");
    return "";
  }

  const { jsPDF } = window.jspdf;
  
  // 1. Alteração de Orientação: Landscape (Paisagem)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // --- CONFIGURATION ---
  const primaryColor = [19, 236, 128]; // #13ec80
  const darkColor = [16, 34, 25]; // #102219
  
  // A4 Landscape Dimensions: 297mm x 210mm
  const pageWidth = doc.internal.pageSize.width; // 297
  const pageHeight = doc.internal.pageSize.height; // 210
  const halfWidth = pageWidth / 2; // ~148.5

  // --- LOGO LOADING ---
  // Usa o URL customizado ou o padrão da Seiva da Nação
  const defaultLogoUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCZDNp2Av10aHiJmlEXi0rniz_bjBSeSZpQzEuLmF4GyO-vlXZuY5DaRqrv9x_v708sEZjAubHOzqUO0GB3S9ITDDNnkzOtn3wKd6RdmZQGI8CV1EBGjBzW-XUVrVWcWS0XEJKojsjPQ7o8fHgEz9lTr8vLQU4XK8WO7k6YRPfsPrKX8dYGGkPl-u9ZN5ToQr2jhRPu8nr_rGFC9s5YALZMjWSf4M8q9DrA6pvy7zqGc5ohf7l2_Jy8vMFi1MlTN__siPQsa8hcovPr";
  const logoUrl = customLogoUrl && customLogoUrl.trim() !== "" ? customLogoUrl : defaultLogoUrl;
  
  let logoBase64 = "";
  try {
      logoBase64 = await getBase64ImageFromURL(logoUrl);
  } catch (e) {
      console.log("Falha ao carregar imagem, usando fallback desenhado.");
  }

  // --- FUNCTION TO DRAW ONE SIDE ---
  const drawReceiptSide = (offsetX: number, title: string) => {
      const margin = 10;
      const contentWidth = halfWidth - (margin * 2);
      let cursorY = 10;

      // Via Title
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(title, offsetX + halfWidth / 2, cursorY, { align: "center" });
      cursorY += 5;

      // Logo
      if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', offsetX + margin, cursorY, 30, 30);
        } catch (err) {
            // Fallback se a imagem estiver corrompida ou formato inválido
             doc.setFillColor(200, 255, 200);
             doc.circle(offsetX + margin + 15, cursorY + 15, 15, 'F');
             doc.setFontSize(10);
             doc.setTextColor(...primaryColor);
             doc.text("SN", offsetX + margin + 15, cursorY + 15, { align: 'center', baseline: 'middle' });
        }
      } else {
         // Fallback desenhado (Círculo Verde) se não baixou a imagem
         doc.setFillColor(...primaryColor);
         doc.circle(offsetX + margin + 15, cursorY + 15, 15, 'F'); // Raio 15 (Diâmetro 30)
         doc.setFontSize(12);
         doc.setTextColor(255, 255, 255);
         doc.text("SN", offsetX + margin + 15, cursorY + 15, { align: 'center', baseline: 'middle' });
      }

      // Header Text (Ajustado X para não sobrepor o logo maior)
      const textStartX = offsetX + margin + 35; 
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("ESCOLA SEIVA DA NAÇÃO", textStartX, cursorY + 8);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text("Av. Samora Machel, Mussumbuluco", textStartX, cursorY + 14);
      doc.text("Maputo - Moçambique", textStartX, cursorY + 18);
      doc.text("Contato: +258 84 269 6623", textStartX, cursorY + 22);

      cursorY += 35;

      // Divider Line
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(offsetX + margin, cursorY, offsetX + halfWidth - margin, cursorY);
      cursorY += 8;

      // Title Receipt
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("RECIBO DE PAGAMENTO", offsetX + halfWidth / 2, cursorY, { align: "center" });
      cursorY += 8;

      // Receipt Meta Info
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      
      const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
      doc.text(`Emissão: ${dateStr}`, offsetX + halfWidth - margin, cursorY, { align: "right" });
      doc.text(`Ref: #${transaction.id}`, offsetX + margin, cursorY, { align: "left" });
      
      cursorY += 5;

      // --- TABLE (2. Atualização de Conteúdo) ---
      // Columns: Descrição, Forma Pagto, Tipo, Valor
      const tableColumn = ["Descrição", "Forma Pagto", "Tipo", "Valor (MZN)"];
      const tableRows = [
        [
          transaction.description,
          transaction.paymentMethod || "N/A", // Nova coluna
          transaction.type,
          transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        ]
      ];

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: cursorY,
        margin: { left: offsetX + margin, right: pageWidth - (offsetX + halfWidth) + margin }, // Constrain to current side
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

      // Get final Y
      cursorY = (doc as any).lastAutoTable.finalY + 15;

      // Total
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text(`Total: MZN ${transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, offsetX + halfWidth - margin, cursorY, { align: "right" });
      
      cursorY += 25;

      // Signature
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);
      doc.line(offsetX + halfWidth / 2 - 30, cursorY, offsetX + halfWidth / 2 + 30, cursorY);

      cursorY += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Tesouraria / Carimbo Digital", offsetX + halfWidth / 2, cursorY, { align: "center" });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "bold italic");
      doc.text("Obrigado por fazer parte da família Seiva da Nação!", offsetX + halfWidth / 2, pageHeight - 10, { align: "center" });
  };

  // Draw Left Side (Instituição)
  drawReceiptSide(0, "Via da Instituição");

  // Draw Right Side (Encarregado)
  drawReceiptSide(halfWidth, "Via do Encarregado");

  // --- CUT LINE (1. Linha pontilhada no meio) ---
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0); // Dotted line
  doc.line(halfWidth, 10, halfWidth, pageHeight - 10);

  return doc.output("bloburl");
};