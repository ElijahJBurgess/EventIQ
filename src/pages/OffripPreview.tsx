// TEMPORARY — visual QA only, remove before final reskin is complete
import Button from "@/components/offrip/Button";
import Card from "@/components/offrip/Card";
import Chip from "@/components/offrip/Chip";
import Input from "@/components/offrip/Input";

export default function OffripPreview() {
  return (
    <main className="min-h-screen bg-offrip-light-gray px-4 py-12 font-offrip-body text-offrip-black">
      <div className="mx-auto max-w-4xl space-y-12">
        <header>
          <Chip color="orange">Visual QA</Chip>
          <h1 className="mt-4 font-offrip-display text-5xl font-black uppercase">OFFRIP Components</h1>
          <p className="mt-3 text-offrip-medium-gray">Standalone component preview. Not connected to the real app.</p>
        </header>

        <section className="space-y-4">
          <h2 className="font-offrip-display text-2xl font-black uppercase">Buttons</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="tertiary">Tertiary Action</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-offrip-display text-2xl font-black uppercase">Cards</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6">
              <Chip color="lime">Static</Chip>
              <h3 className="mt-4 font-offrip-display text-xl font-black uppercase">Static Card</h3>
              <p className="mt-2 text-offrip-medium-gray">No hover treatment or shadow.</p>
            </Card>
            <Card interactive className="p-6">
              <Chip color="aqua">Interactive</Chip>
              <h3 className="mt-4 font-offrip-display text-xl font-black uppercase">Interactive Card</h3>
              <p className="mt-2 text-offrip-medium-gray">Hover to see the hard shadow.</p>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-offrip-display text-2xl font-black uppercase">Chips</h2>
          <div className="flex flex-wrap gap-3">
            <Chip color="aqua">Aqua</Chip>
            <Chip color="orange">Orange</Chip>
            <Chip color="lime">Lime</Chip>
            <Chip color="blue">Blue</Chip>
            <Chip color="black">Black</Chip>
            <Chip color="light-gray">Light Gray</Chip>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-offrip-display text-2xl font-black uppercase">Inputs</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Input id="preview-name" label="Your name" placeholder="Enter your name" />
            <Input placeholder="Input without a label" />
            <Input label="Disabled input" value="Unavailable" disabled readOnly />
          </div>
        </section>
      </div>
    </main>
  );
}
