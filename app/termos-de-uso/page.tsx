import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactEmail, LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Termos de Uso | Menu Flow',
  description: 'Regras gerais de uso da plataforma Menu Flow para clientes, estabelecimentos e operadores.',
  alternates: { canonical: 'https://www.menuflowapps.com/termos-de-uso' }
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" summary="Condições gerais para utilizar os cardápios, pedidos e recursos de gestão disponibilizados pelo Menu Flow.">
      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">1. Sobre o serviço</h2>
        <p>O Menu Flow disponibiliza tecnologia para divulgação de cardápios, registro e acompanhamento de pedidos e administração de estabelecimentos. Os produtos, preços, disponibilidade, horários e condições de atendimento são definidos pelos estabelecimentos cadastrados, de acordo com a respectiva operação.</p>
        <p>Ao utilizar os recursos da plataforma, o usuário deve observar estes Termos e a legislação aplicável. Condições comerciais específicas contratadas por estabelecimentos podem ser complementadas por documentos próprios.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">2. Uso por clientes</h2>
        <p>A navegação em cardápios públicos pode ocorrer sem cadastro. Para realizar pedidos, o cliente deve fornecer dados verdadeiros e suficientes à preparação, confirmação e entrega ou retirada, conforme a modalidade disponível.</p>
        <p>Antes de confirmar o pedido, confira itens, quantidades, preços, taxas, endereço e informações exibidas. O estabelecimento é responsável por informar sua política de atendimento, cancelamento, disponibilidade de produtos e eventual reembolso, respeitando os direitos do consumidor.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">3. Responsabilidades dos estabelecimentos</h2>
        <p>O lojista é responsável por manter corretas as informações de seu negócio, cardápio, preços, taxas, horários, meios de pagamento, disponibilidade, equipe e instruções de entrega. Também deve cumprir suas obrigações legais, fiscais, sanitárias e de atendimento ao consumidor, quando aplicáveis.</p>
        <p>É responsabilidade do estabelecimento conceder acesso apenas a pessoas autorizadas, proteger as credenciais de seus funcionários e utilizar de forma legítima os dados recebidos por meio da plataforma.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">4. Pedidos, pagamentos e entregas</h2>
        <p>O Menu Flow fornece recursos de intermediação tecnológica e gestão de pedidos; não é, por esse motivo, necessariamente o vendedor dos produtos apresentados por cada loja. Cobranças, formas de pagamento e condições de entrega podem variar conforme o estabelecimento e os prestadores envolvidos.</p>
        <p>Integrações logísticas e de comunicação, quando habilitadas, dependem também da disponibilidade e das regras dos respectivos serviços. O status de um pedido deve refletir os eventos efetivamente registrados e confirmados pela operação.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">5. WhatsApp e atendimento automático</h2>
        <p>Os estabelecimentos podem conectar números próprios à WhatsApp Business Platform para oferecer mensagens de atendimento e compartilhar links de cardápios. O atendimento automatizado depende da ativação pelo estabelecimento, das permissões da plataforma e das regras da Meta/WhatsApp.</p>
        <p>O uso dessa integração não autoriza mensagens indevidas, disparos não solicitados ou qualquer prática contrária às regras do WhatsApp e à legislação de proteção de dados e de consumo.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">6. Segurança e uso adequado</h2>
        <p>Não é permitido tentar acessar contas de terceiros, contornar controles de segurança, interferir nos serviços, inserir informações fraudulentas ou utilizar o Menu Flow de forma ilegal. A plataforma pode adotar medidas proporcionais de proteção e restrição de acesso diante de indícios de abuso, observadas as condições aplicáveis.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">7. Disponibilidade e alterações</h2>
        <p>Buscamos oferecer um serviço confiável, mas recursos podem sofrer interrupções técnicas, manutenções ou indisponibilidades de prestadores externos. Estes Termos podem ser atualizados quando houver mudanças relevantes nas funcionalidades ou exigências legais. A versão atual será publicada nesta página.</p>
        <p>Estes Termos não afastam direitos assegurados pela legislação brasileira, inclusive o Código de Defesa do Consumidor e a LGPD, quando aplicáveis.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">8. Privacidade e contato</h2>
        <p>Para entender como as informações pessoais são tratadas, consulte a <Link href="/politica-de-privacidade" className="font-semibold text-primary underline underline-offset-4">Política de Privacidade</Link>. Dúvidas relativas à plataforma ou a estes Termos podem ser enviadas para <ContactEmail />. Questões sobre preparo, venda ou entrega de um pedido também devem ser direcionadas ao estabelecimento responsável.</p>
      </section>
    </LegalPage>
  );
}
