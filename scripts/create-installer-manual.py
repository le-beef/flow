from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "assets" / "installer" / "ICOVERDE.png"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
OUTPUT = ROOT / "output" / "pdf" / f"Manual-de-Instalacao-AtendeFlow-{VERSION}.pdf"

GREEN = colors.HexColor("#174D30")
GREEN_2 = colors.HexColor("#2E7650")
MINT = colors.HexColor("#EAF3ED")
INK = colors.HexColor("#17221B")
MUTED = colors.HexColor("#5F7066")
LINE = colors.HexColor("#D7E3DB")
WARN = colors.HexColor("#FFF4D8")
RED_BG = colors.HexColor("#FCE9E7")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=GREEN, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name="CoverSub", fontName="Helvetica", fontSize=11, leading=16, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=GREEN, spaceAfter=10))
styles.add(ParagraphStyle(name="H2x", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=GREEN_2, spaceBefore=9, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Smallx", fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="StepNum", fontName="Helvetica-Bold", fontSize=15, textColor=colors.white, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="StepTitle", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK))
styles.add(ParagraphStyle(name="StepBody", fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED))


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def bullet(text):
    return Paragraph("&#8226;&nbsp; " + text, ParagraphStyle(name="bullet-temp", parent=styles["Bodyx"], leftIndent=10, firstLineIndent=-7, spaceAfter=4))


def callout(title, text, warning=False):
    bg = WARN if warning else MINT
    data = [[p(title, "StepTitle")], [p(text, "StepBody")]]
    table = Table(data, colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
    ]))
    return KeepTogether([table, Spacer(1, 5 * mm)])


def step(number, title, body):
    badge = Table([[p(str(number), "StepNum")]], colWidths=[12 * mm], rowHeights=[12 * mm])
    badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    content = [p(title, "StepTitle"), p(body, "StepBody")]
    table = Table([[badge, content]], colWidths=[16 * mm, 151 * mm])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE)]))
    return table


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 9 * mm, f"AtendeFlow | Manual de instalação | Versão {VERSION}")
    canvas.drawRightString(width - 20 * mm, 9 * mm, f"Página {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm, title=f"Manual de Instalação AtendeFlow {VERSION}", author="AtendeFlow")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=header_footer)])

story = []
story += [Spacer(1, 25 * mm), Image(str(LOGO), width=42 * mm, height=42 * mm), Spacer(1, 10 * mm), p("Manual de Instalação", "CoverTitle"), p(f"AtendeFlow - Versão {VERSION}", "CoverSub"), Spacer(1, 6 * mm), p("Guia detalhado para preparar o computador, instalar o sistema, conectar o WhatsApp e resolver os problemas mais comuns.", "CoverSub"), Spacer(1, 28 * mm)]
cover_box = Table([[p("INSTALAÇÃO PARA WINDOWS 10 OU WINDOWS 11", "StepTitle")], [p("Use o arquivo Instalar-AtendeFlow.exe incluído no pacote. Mantenha todos os arquivos extraídos na mesma pasta.", "StepBody")]], colWidths=[150 * mm])
cover_box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), MINT), ("BOX", (0, 0), (-1, -1), 1, LINE), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
story += [cover_box, PageBreak()]

story += [p("1. Antes de começar", "H1x"), p("Separe de 20 a 40 minutos. O tempo depende da velocidade da internet e do computador. Durante a instalação, o Windows poderá reiniciar uma vez.")]
for item in ["Windows 10 ou Windows 11 de 64 bits, atualizado.", "Conta do Windows com permissão de administrador.", "Conexão estável com a internet.", "Pelo menos 10 GB de espaço livre em disco.", "Virtualização do processador habilitada na BIOS/UEFI.", "Celular com o WhatsApp da empresa disponível para leitura do QR Code."]:
    story.append(bullet(item))
story += [Spacer(1, 3 * mm), callout("Importante: extraia o ZIP", "Não execute o instalador diretamente dentro do arquivo ZIP. Clique com o botão direito no ZIP, escolha <b>Extrair Tudo</b> e abra a pasta extraída. O EXE precisa enxergar as pastas scripts, apps e assets.", True)]
story += [p("O que o instalador configura", "H2x")]
data = [[p("Componente", "StepTitle"), p("O que acontece", "StepTitle")], [p("Recursos do Windows", "Bodyx"), p("Ativa WSL, Virtual Machine Platform e Hypervisor Platform quando necessário.", "Bodyx")], [p("Node.js LTS", "Bodyx"), p("Instala automaticamente pelo Winget se não estiver presente.", "Bodyx")], [p("Docker Desktop", "Bodyx"), p("Instala automaticamente e inicia o serviço de containers.", "Bodyx")], [p("AtendeFlow", "Bodyx"), p("Instala dependências, banco, Evolution API, interface e automação.", "Bodyx")], [p("Inicialização e backup", "Bodyx"), p("Configura inicialização com o Windows e backup diário às 03:00.", "Bodyx")]]
t = Table(data, colWidths=[42 * mm, 125 * mm], repeatRows=1)
t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
story += [t, PageBreak()]

story += [p("2. Instalação passo a passo", "H1x")]
steps = [
    (1, "Extraia o pacote", f"Clique com o botão direito em <b>AtendeFlow-{VERSION}-Instalador-....zip</b>, selecione <b>Extrair Tudo</b> e confirme. Abra a pasta AtendeFlow criada."),
    (2, "Execute o instalador", "Dê dois cliques em <b>Instalar-AtendeFlow.exe</b>. Se o Windows mostrar a proteção SmartScreen, clique em <b>Mais informações</b> e depois em <b>Executar assim mesmo</b>."),
    (3, "Autorize o administrador", "Na janela Controle de Conta de Usuário, confira o nome AtendeFlow e clique em <b>Sim</b>. Essa permissão é necessária para recursos do Windows, Docker e tarefas agendadas."),
    (4, "Aguarde a verificação", "O instalador verifica virtualização, Winget, Node.js e Docker. Não feche a janela. Se um componente já existir, ele será mantido."),
    (5, "Aceite o reinício", "Se WSL, virtualização do Windows ou Docker forem instalados, o computador avisará que reiniciará em 20 segundos. Salve outros trabalhos. A instalação continuará automaticamente após entrar novamente no Windows."),
    (6, "Conclua o primeiro início do Docker", "Se o Docker Desktop abrir pedindo termos, aceite-os. Aguarde o ícone do Docker informar que o mecanismo está em execução. Caso a instalação não continue, execute o EXE novamente."),
    (7, "Aguarde a criação do sistema", "O instalador cria segredos locais, inicia PostgreSQL e Evolution API, prepara o banco e compila o painel. Esse estágio pode levar vários minutos."),
    (8, "Confirme a conclusão", "Ao final aparecerá <b>AtendeFlow instalado com sucesso</b>. O painel abrirá em <b>http://localhost:5173/</b> e um atalho será criado na Área de Trabalho."),
]
for row in steps:
    story += [step(*row), Spacer(1, 3 * mm)]
story += [callout("Não desligue o computador durante a configuração", "Apenas o reinício solicitado pelo próprio instalador é esperado. Interromper a criação do banco ou dos containers pode deixar a instalação incompleta.", True), PageBreak()]

story += [p("3. Primeiro acesso e configuração", "H1x")]
for item in ["Abra o atalho AtendeFlow na Área de Trabalho ou acesse http://localhost:5173/.", "Entre com o usuário administrador configurado para a instalação.", "Se for solicitado, substitua imediatamente a senha temporária por uma senha com pelo menos 8 caracteres.", "Abra Configurações > Empresa e informe nome, responsável, telefone, segmento, endereço e cor principal.", "Abra Configurações > Mensagens e revise saudação, mensagem fora do horário e resposta de fallback.", "Abra Configurações > Horários e marque os dias e intervalos reais de atendimento.", "Abra Automação e revise gatilhos, anexos e opções do menu. Ative somente as regras que deverão responder."]:
    story.append(bullet(item))
story += [callout("Licença de avaliação", "Uma instalação nova pode iniciar com licença de avaliação de 7 dias. Para renovar, abra <b>Configurações > Administração</b>, copie o código da instalação e cole a chave gerada para aquele cliente."), PageBreak()]

story += [p("4. Conectar o WhatsApp", "H1x"), step(1, "Abra a conexão", "No menu lateral do AtendeFlow, clique em <b>Conectar WhatsApp</b>."), Spacer(1, 3 * mm), step(2, "Gere o QR Code", "Clique em <b>Gerar QR Code</b> e aguarde a imagem aparecer."), Spacer(1, 3 * mm), step(3, "Use o celular", "No WhatsApp do celular, abra <b>Configurações > Aparelhos conectados > Conectar aparelho</b> e leia o QR Code."), Spacer(1, 3 * mm), step(4, "Confirme o status", "Aguarde o painel mostrar <b>WhatsApp conectado</b>. O indicador lateral muda automaticamente de acordo com o estado da conexão."), Spacer(1, 5 * mm)]
story += [callout("Uma conexão por número", "Não é necessário gerar um QR Code em cada navegador. A sessão pertence à instância do AtendeFlow. Use <b>Desconectar / trocar número</b> somente quando realmente quiser vincular outro WhatsApp."), p("Teste recomendado", "H2x")]
for item in ["Envie uma primeira mensagem de outro celular e confira a saudação única.", "Envie 'cardápio' e confirme o gatilho e o anexo, se configurado.", "Teste fora do horário e confira a mensagem de estabelecimento fechado.", "Escolha atendimento humano e confirme que a automação pausa por 24 horas.", "Abra a conversa pelo AtendeFlow e responda no WhatsApp Web."]:
    story.append(bullet(item))
story += [PageBreak()]

story += [p("5. Problemas comuns", "H1x")]
problems = [
    ("Virtualização desativada", "Entre na BIOS/UEFI e habilite Intel Virtualization Technology, Intel VT-x ou AMD SVM/AMD-V. Salve, reinicie e execute o instalador novamente."),
    ("Winget não encontrado", "Abra a Microsoft Store, atualize o aplicativo App Installer e reinicie o Windows."),
    ("Docker não ficou pronto", "Abra o Docker Desktop, aceite os termos, aguarde o status Running e execute o instalador novamente."),
    ("SmartScreen bloqueou o EXE", "Clique em Mais informações e Executar assim mesmo. Use somente o pacote recebido do fornecedor e confira a versão do arquivo."),
    ("Painel não abriu", "Aguarde dois minutos e acesse http://localhost:5173/. Se não abrir, consulte logs/atendeflow-error.log e logs/instalacao-windows.log."),
    ("QR Code não conecta", "Confirme internet, data e hora do Windows, remova aparelhos antigos no WhatsApp e gere um novo QR Code."),
    ("Instalação interrompida", "Execute Instalar-AtendeFlow.exe novamente. O processo preserva componentes já instalados e tenta concluir o restante."),
]
for title, body in problems:
    box = Table([[p(title, "StepTitle")], [p(body, "StepBody")]], colWidths=[167 * mm])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), RED_BG), ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story += [box, Spacer(1, 3 * mm)]
story += [PageBreak()]

story += [p("6. Operação, backup e suporte", "H1x"), p("O AtendeFlow deve permanecer com o Docker Desktop em funcionamento. O painel administra somente a automação e o histórico; respostas humanas são feitas no WhatsApp Web.")]
story += [p("Atualizações", "H2x"), bullet("Administradores podem verificar novas versões em Configurações > Sistema."), bullet("Antes de instalar, o AtendeFlow confere versão, compatibilidade, tamanho e SHA-256 do pacote."), bullet("A instalação cria backup do banco e um ponto de restauração dos arquivos."), bullet("Durante a atualização, o painel pode ficar indisponível por alguns minutos."), bullet("Se a nova versão não iniciar, o atualizador tenta restaurar automaticamente a versão anterior.")]
story += [p("Backup", "H2x"), bullet("O instalador tenta agendar um backup diário para 03:00."), bullet("Backups manuais podem ser feitos com scripts/backup.ps1."), bullet("Para restaurar, use scripts/restore.ps1 com um arquivo SQL criado pelo AtendeFlow."), p("Antes de pedir suporte", "H2x")]
for item in ["Anote a versão exibida no rodapé do menu lateral.", "Informe se o indicador do WhatsApp está conectado, conectando ou desconectado.", "Separe logs/instalacao-windows.log ou logs/atendeflow-error.log.", "Nunca envie a chave privada do gerador de licenças, senhas ou o arquivo .env por canais públicos."]:
    story.append(bullet(item))
story += [Spacer(1, 6 * mm), callout("Checklist de conclusão", "[ ] Painel abre em localhost:5173<br/>[ ] Empresa e horários configurados<br/>[ ] WhatsApp conectado<br/>[ ] Saudação testada<br/>[ ] Gatilhos e anexos testados<br/>[ ] Mensagem fora do horário testada<br/>[ ] Backup confirmado"), Spacer(1, 12 * mm), p("AtendeFlow - comunicação organizada, automação previsível e atendimento humano pelo WhatsApp Web.", "CoverSub")]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc.build(story)
print(OUTPUT)
