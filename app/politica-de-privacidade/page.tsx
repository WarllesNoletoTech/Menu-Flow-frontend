import type { Metadata } from 'next';
import { ContactEmail, LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Menu Flow',
  description: 'Conheça como o Menu Flow trata dados pessoais em cardápios, pedidos e atendimento por WhatsApp.',
  alternates: { canonical: 'https://www.menuflowapps.com/politica-de-privacidade' }
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Política de Privacidade" summary="Explicamos quais informações podem ser utilizadas no Menu Flow e como solicitar atendimento sobre seus dados pessoais.">
      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">1. Quem somos e a quem se aplica</h2>
        <p>O Menu Flow é uma plataforma de cardápios digitais, pedidos e gestão para estabelecimentos comerciais. Esta Política descreve o tratamento de informações realizado no site, nos painéis e nas integrações disponibilizadas pela plataforma, incluindo os canais de atendimento conectados pelos estabelecimentos.</p>
        <p>Em algumas operações, o Menu Flow define as finalidades do tratamento, por exemplo na administração da plataforma. Em outras, a loja que recebe o pedido ou atende o cliente define a finalidade do uso dos dados, e o Menu Flow atua como prestador tecnológico. Cada estabelecimento também pode ter suas próprias políticas e responsabilidades.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">2. Informações que podem ser tratadas</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Clientes:</strong> nome, telefone, dados de entrega, endereço, observações fornecidas no pedido, itens solicitados e histórico de pedidos quando disponível.</li>
          <li><strong>Lojistas e funcionários:</strong> dados cadastrais, dados de contato, identificação de acesso, permissões e registros necessários à operação do estabelecimento.</li>
          <li><strong>Conversas:</strong> número de WhatsApp, conteúdo de mensagens e dados de status necessários ao atendimento quando o estabelecimento habilita a integração oficial.</li>
          <li><strong>Uso técnico:</strong> registros de acesso, informações do navegador e dispositivo, identificadores de sessão e eventos de segurança necessários ao funcionamento e à proteção da plataforma.</li>
        </ul>
        <p>Não é necessário criar uma conta para apenas consultar cardápios públicos. Para concluir um pedido, podem ser solicitadas as informações pertinentes à modalidade escolhida, como entrega ou retirada.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">3. Para que usamos as informações</h2>
        <p>As informações podem ser utilizadas para exibir cardápios e estabelecimentos; registrar, encaminhar e acompanhar pedidos; viabilizar entregas e retiradas; permitir o atendimento por mensagens; administrar acessos e permissões; emitir informações operacionais e relatórios; prestar suporte; prevenir fraudes; cumprir obrigações legais; e manter a segurança e a estabilidade do serviço.</p>
        <p>O tratamento ocorre conforme as bases legais aplicáveis da Lei Geral de Proteção de Dados Pessoais (LGPD), que podem incluir execução de contrato ou procedimentos relacionados, cumprimento de obrigação legal ou regulatória, legítimo interesse quando cabível e consentimento nos casos em que ele seja necessário.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">4. Compartilhamento e integrações</h2>
        <p>Os dados necessários a um pedido podem ser acessados pelo estabelecimento responsável e, quando aplicável, por seus funcionários autorizados e pelos responsáveis pela entrega. O Menu Flow pode utilizar prestadores de hospedagem, armazenamento, infraestrutura, comunicação e suporte, limitados às finalidades pertinentes.</p>
        <p>Quando habilitadas, integrações como WhatsApp Business Platform (Meta), Rappidex e outros serviços conectados podem receber as informações estritamente necessárias à funcionalidade utilizada. Esses serviços também podem tratar dados conforme suas próprias políticas e contratos. Eventuais transferências internacionais de dados deverão observar os requisitos legais aplicáveis.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">5. Armazenamento, segurança e conservação</h2>
        <p>Adotamos medidas técnicas e organizacionais voltadas à proteção dos dados, como controles de acesso e mecanismos de segurança adequados às operações realizadas. Nenhum sistema conectado à internet pode oferecer garantia absoluta contra incidentes.</p>
        <p>Os dados são conservados pelo tempo necessário às finalidades legítimas do tratamento e às obrigações legais aplicáveis. Mesmo após a exclusão de uma conta ou o encerramento de um atendimento, determinados registros de pedidos e transações podem precisar ser preservados por obrigação legal, segurança ou exercício regular de direitos.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">6. Cookies e sessões</h2>
        <p>O site e seus painéis podem utilizar armazenamento local, cookies ou tecnologias semelhantes para manter sessões, preferências de navegação e funcionalidades essenciais. Recursos de terceiros eventualmente integrados podem aplicar suas próprias tecnologias conforme sua configuração.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">7. Seus direitos</h2>
        <p>Nos termos da LGPD, você pode solicitar, conforme o caso, confirmação de tratamento, acesso, correção, informações sobre compartilhamento, anonimização, bloqueio, eliminação, portabilidade, oposição ou revogação de consentimento. Alguns pedidos podem depender de validação de identidade e estar sujeitos às hipóteses legais de conservação.</p>
        <p>Para exercer seus direitos, escreva para <ContactEmail />. Caso os dados estejam sob responsabilidade de uma loja cadastrada, o pedido poderá precisar ser direcionado ao estabelecimento controlador, com orientação ou apoio do Menu Flow conforme a operação envolvida.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">8. Atualizações e contato</h2>
        <p>Esta Política pode ser atualizada para refletir mudanças na plataforma, nas integrações ou nas exigências legais. A versão vigente será disponibilizada nesta página com a data da atualização.</p>
        <p>Dúvidas relacionadas à privacidade podem ser enviadas para <ContactEmail />. Para orientações específicas sobre remoção de informações, consulte a página <a href="/exclusao-de-dados" className="font-semibold text-primary underline underline-offset-4">Exclusão de Dados</a>.</p>
      </section>
    </LegalPage>
  );
}
