import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { Inter } from "next/font/google";

function Card(props: { readonly label: string }) {
	return <div>{props.label}</div>;
}

Inter({ variable: "font-inter" });

export function InvalidNativeTsx() {
	return (
		<main>
			<Link>Missing href</Link>
			<Image src="/hero.png" />
			<Form><button type="submit">Missing action</button></Form>
			<Script strategy="idle" />
			<Card />
		</main>
	);
}
