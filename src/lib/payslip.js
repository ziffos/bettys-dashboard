/**
 * The payslip PDF an employee downloads for a month.
 *
 * Lifted unchanged out of the old My Payroll page when that screen was rebuilt
 * — the layout has been in front of real staff and there was no reason to
 * redraw it. It takes the month row the screen has already worked out, plus the
 * profile it belongs to.
 *
 * jspdf and jspdf-autotable are imported on demand: together they are larger
 * than the rest of the page, and most visits never press the button.
 */

const r2 = (n) => Math.round(n * 100) / 100;

export async function generatePayslip(row, profile) {
    const jsPDFModule = await import("jspdf");
    const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
    const autoTableModule = await import("jspdf-autotable");
    autoTableModule.applyPlugin(jsPDF);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Load logo
    let logoImg = null;
    try {
      const response = await fetch("/images/betty_logo.png");
      const blob = await response.blob();
      logoImg = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {
      // Continue without logo
    }

    // ── HEADER ──
    if (logoImg) {
      doc.addImage(logoImg, "PNG", margin, y, 22, 22);
    }
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("Payslip", pageWidth - margin, y + 14, { align: "right" });

    y += 28;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    // ── EMPLOYEE DETAILS ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("EMPLOYEE DETAILS", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(10);

    const details = [
      ["Employee", profile.full_name],
      ["Period", row.label],
      ["Generated", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ];
    for (const [label, value] of details) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(value, margin + 40, y);
      y += 6;
    }
    y += 10;

    // ── EARNINGS ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("EARNINGS", margin, y);
    y += 4;

    const earningsBody = [
      [`Basic pay (${row.totalHours}h x \u20AC${row.hourlyRate})`, `\u20AC${r2(row.totalHours * row.hourlyRate).toFixed(2)}`],
    ];
    if (row.monthlyBonus > 0) {
      earningsBody.push([
        row.bonusDescription || "Monthly bonus",
        `\u20AC${Number(row.monthlyBonus).toFixed(2)}`,
      ]);
    }
    earningsBody.push([
      { content: "Gross Total", styles: { fontStyle: "bold" } },
      { content: `\u20AC${row.grossExpected.toFixed(2)}`, styles: { fontStyle: "bold" } },
    ]);

    doc.autoTable({
      startY: y,
      head: [["Description", "Amount"]],
      body: earningsBody,
      margin: { left: margin, right: margin },
      theme: "plain",
      headStyles: { fillColor: [245, 245, 245], textColor: [80, 80, 80], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [33, 33, 33] },
      columnStyles: { 1: { halign: "right" } },
      styles: { cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.3 },
    });
    y = doc.lastAutoTable.finalY + 14;

    // ── HOURS SUMMARY ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("HOURS SUMMARY", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(10);

    const hoursSummary = [
      ["Total hours worked", `${row.totalHours} hours`],
      ["Hourly rate", `\u20AC${row.hourlyRate} / hour`],
    ];
    for (const [label, value] of hoursSummary) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(value, margin + 55, y);
      y += 6;
    }
    y += 10;

    // ── PAYMENT HISTORY ──
    if (row.payments.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("PAYMENT HISTORY", margin, y);
      y += 4;

      const paymentBody = row.payments.map((p) => [
        new Date(p.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        `\u20AC${Number(p.amount).toFixed(2)}`,
        p.payment_note || "-",
      ]);
      paymentBody.push([
        { content: "Total Paid", styles: { fontStyle: "bold" } },
        { content: `\u20AC${Number(row.amountPaid).toFixed(2)}`, styles: { fontStyle: "bold" } },
        "",
      ]);

      doc.autoTable({
        startY: y,
        head: [["Date", "Amount", "Note"]],
        body: paymentBody,
        margin: { left: margin, right: margin },
        theme: "plain",
        headStyles: { fillColor: [245, 245, 245], textColor: [80, 80, 80], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [33, 33, 33] },
        columnStyles: { 1: { halign: "right" } },
        styles: { cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.3 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ── FOOTER ──
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text("This is an automatically generated payslip.", margin, footerY);
    doc.text("Betty's Crispy Chicken, Limassol, Cyprus", pageWidth - margin, footerY, { align: "right" });

    // ── SAVE ──
    const monthName = new Date(row.year, row.month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
    const empName = (profile.full_name || "Employee").split(" ")[0];
    doc.save(`Payslip_${empName}_${monthName}_${row.year}.pdf`);
}
