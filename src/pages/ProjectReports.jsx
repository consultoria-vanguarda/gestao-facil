import React from 'react';
import { api } from '@/api/appApi';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { ArrowLeft, DollarSign, Clock, TrendingUp, Percent, BarChart3, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ProjectReports() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await api.entities.Project.filter({ id: projectId });
      return projects[0];
    },
    enabled: !!projectId,
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables', projectId],
    queryFn: () => api.entities.ProjectReceivable.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables', projectId],
    queryFn: () => api.entities.ProjectPayable.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries', projectId],
    queryFn: () => api.entities.TimeEntry.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => api.entities.Consultant.list(),
  });

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  // Financial calculations
  const contractedValue = project.contracted_value || 0;
  const receivedRevenue = receivables
    .filter(r => r.status === 'received')
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  
  const workedHours = timeEntries.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
  const laborCost = workedHours * (project.hourly_rate || 0);
  
  const paidExpenses = payables
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const totalCosts = laborCost + paidExpenses;
  const margin = receivedRevenue - totalCosts;
  const marginPercent = receivedRevenue > 0 ? (margin / receivedRevenue) * 100 : 0;

  const estimatedHours = project.estimated_hours || 0;
  const revenuePerHour = workedHours > 0 ? receivedRevenue / workedHours : 0;
  const costPerHour = workedHours > 0 ? totalCosts / workedHours : 0;
  const marginPerHour = workedHours > 0 ? margin / workedHours : 0;

  // Consultant performance breakdown
  const consultantStats = consultants
    .map(consultant => {
      const consultantEntries = timeEntries.filter(t => t.consultant_id === consultant.id);
      const consultantHours = consultantEntries.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
      
      if (consultantHours === 0) return null;
      
      const attributedRevenue = workedHours > 0 
        ? (consultantHours / workedHours) * receivedRevenue 
        : 0;

      const attributedCosts = payables
        .filter(p => p.consultant_id === consultant.id && p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const consultantMargin = attributedRevenue - attributedCosts;
      const consultantMarginPercent = attributedRevenue > 0 
        ? (consultantMargin / attributedRevenue) * 100 
        : 0;

      return {
        id: consultant.id,
        name: consultant.name,
        hours: consultantHours,
        revenue: attributedRevenue,
        costs: attributedCosts,
        margin: consultantMargin,
        marginPercent: consultantMarginPercent
      };
    })
    .filter(c => c !== null);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Título
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Relatório Financeiro do Projeto', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(project.name, pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 34, { align: 'center' });
    
    let yPos = 45;
    
    // Resumo Executivo
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Resumo Executivo', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const summaryData = [
      ['Receita Prevista', `R$ ${contractedValue.toFixed(2)}`],
      ['Receita Real', `R$ ${receivedRevenue.toFixed(2)}`],
      ['Custos Reais', `R$ ${totalCosts.toFixed(2)}`],
      ['Margem', `R$ ${margin.toFixed(2)} (${marginPercent.toFixed(1)}%)`]
    ];
    
    doc.autoTable({
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
      margin: { left: 14, right: 14 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // DRE
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('DRE - Demonstração do Resultado', 14, yPos);
    yPos += 8;
    
    const dreData = [
      ['Receita Prevista (Contratado)', `R$ ${contractedValue.toFixed(2)}`],
      ['Receita Real (Recebido)', `R$ ${receivedRevenue.toFixed(2)}`],
      ['(-) Custos Reais Totais', `R$ ${totalCosts.toFixed(2)}`],
      ['  Custo de Horas Trabalhadas', `R$ ${laborCost.toFixed(2)}`],
      ['  Despesas Pagas', `R$ ${paidExpenses.toFixed(2)}`],
      ['(=) Margem Líquida', `R$ ${margin.toFixed(2)} (${marginPercent.toFixed(1)}%)`]
    ];
    
    doc.autoTable({
      startY: yPos,
      body: dreData,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { fontStyle: 'bold' }
      }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // Análise de Horas
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Análise de Horas', 14, yPos);
    yPos += 8;
    
    const hoursData = [
      ['Horas Estimadas', `${estimatedHours.toFixed(1)}h`],
      ['Horas Realizadas', `${workedHours.toFixed(1)}h`],
      ['Receita/Hora Real', `R$ ${revenuePerHour.toFixed(2)}`],
      ['Custo/Hora Real', `R$ ${costPerHour.toFixed(2)}`],
      ['Margem/Hora Real', `R$ ${marginPerHour.toFixed(2)}`]
    ];
    
    doc.autoTable({
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: hoursData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
      margin: { left: 14, right: 14 }
    });
    
    // Nova página para consultor
    if (consultantStats.length > 0) {
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Desempenho por Consultor', 14, yPos);
      yPos += 8;
      
      const consultantData = consultantStats.map(stat => [
        stat.name,
        `${stat.hours.toFixed(1)}h`,
        `R$ ${stat.revenue.toFixed(2)}`,
        `R$ ${stat.costs.toFixed(2)}`,
        `R$ ${stat.margin.toFixed(2)}`,
        `${stat.marginPercent.toFixed(1)}%`
      ]);
      
      doc.autoTable({
        startY: yPos,
        head: [['Consultor', 'Horas', 'Receita', 'Custos', 'Margem', 'Margem %']],
        body: consultantData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9 }
      });
    }
    
    doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={createPageUrl(`ProjectDetail?id=${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Relatórios e Análises</h1>
          <p className="text-slate-500">{project.name}</p>
        </div>
        <Button onClick={exportToPDF} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Resumo Executivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Receita Prevista</p>
                <p className="font-semibold text-slate-900">R$ {contractedValue.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Receita Real</p>
                <p className="font-semibold text-emerald-600">R$ {receivedRevenue.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-50">
                <DollarSign className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Custos Reais</p>
                <p className="font-semibold text-rose-600">R$ {totalCosts.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${margemReais >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <Percent className={`w-5 h-5 ${margemReais >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Margem</p>
                <p className={`font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {marginPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DRE do Projeto */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            DRE - Demonstração do Resultado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-slate-700">Receita Prevista (Contratado)</span>
              <span className="font-semibold text-slate-900">R$ {contractedValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-emerald-700">Receita Real (Recebido)</span>
              <span className="font-semibold text-emerald-700">R$ {receivedRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-b bg-rose-50 -mx-4 px-4">
              <span className="font-medium text-rose-700">(-) Custos Reais Totais</span>
              <span className="font-semibold text-rose-700">R$ {totalCosts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 pl-4 border-b">
              <span className="text-sm text-slate-600">Custo de Horas ({workedHours.toFixed(1)}h × R$ {(project.hourly_rate || 0).toFixed(2)})</span>
              <span className="font-medium text-rose-600">R$ {laborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 pl-4 border-b">
              <span className="text-sm text-slate-600">Despesas Pagas</span>
              <span className="font-medium text-rose-600">R$ {paidExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-slate-300 mt-2">
              <span className="font-bold text-lg text-slate-900">(=) Margem Líquida</span>
              <span className={`font-bold text-lg ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                R$ {margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análise de Horas */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Análise de Horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Horas Estimadas</p>
              <p className="text-2xl font-bold text-slate-900">{estimatedHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Horas Realizadas</p>
              <p className="text-2xl font-bold text-blue-600">{workedHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Receita/Hora Real</p>
              <p className="text-2xl font-bold text-emerald-600">R$ {revenuePerHour.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Custo/Hora Real</p>
              <p className="text-2xl font-bold text-rose-600">R$ {costPerHour.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Margem/Hora Real</p>
              <p className={`text-2xl font-bold ${marginPerHour >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                R$ {marginPerHour.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Desvio:</strong> {estimatedHours > 0 
                ? `${((workedHours / estimatedHours - 1) * 100).toFixed(1)}%`
                : 'N/A'
              } em relação ao estimado
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Relatório por Consultor */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Desempenho por Consultor</CardTitle>
        </CardHeader>
        <CardContent>
          {consultantStats.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum apontamento de horas registrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Receita Atribuída</TableHead>
                  <TableHead className="text-right">Custos</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultantStats.map((stat) => (
                  <TableRow key={stat.id}>
                    <TableCell className="font-medium">{stat.name}</TableCell>
                    <TableCell className="text-right">{stat.hours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">
                      R$ {stat.revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-rose-600 font-medium">
                      R$ {stat.costs.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${stat.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {stat.margin.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${stat.marginPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stat.marginPercent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {consultantStats.length > 0 && workedHours === 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-900">
                <strong>Atenção:</strong> Sem apontamentos de horas. A receita atribuída está usando o valor previsto como base.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}