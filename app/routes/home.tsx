import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hy-An | Link In Bio" },
    {
      name: "description",
      content: "Hy-An — est. 1995. Listen, watch, follow.",
    },
  ];
}

export default function Home() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="text-center">
        <img
          src="/hyan_logo.svg"
          alt="Hy-An"
          className="mx-auto mb-4 w-64 h-64"
        />
        <p className="text-gray-700">est. 1995</p>
        <p className="mt-8 text-sm text-gray-500">
          Coming soon
        </p>
      </div>
    </main>
  );
}
