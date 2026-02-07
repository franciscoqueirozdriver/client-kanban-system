CREATE TABLE `concorrentes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`perDcompId` int NOT NULL,
	`nomeEmpresa` varchar(255) NOT NULL,
	`cnpj` varchar(18) NOT NULL,
	`quantitativoTotal` decimal(15,2),
	`naturezasCreditos` text,
	`cancelamentos` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concorrentes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `per_dcomp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaPrincipal` varchar(255) NOT NULL,
	`cnpjPrincipal` varchar(18) NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp NOT NULL,
	`quantitativoTotal` decimal(15,2),
	`naturezasCreditos` text,
	`cancelamentos` text,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `per_dcomp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tema` varchar(255) NOT NULL,
	`tipo` varchar(100) NOT NULL,
	`tributo` varchar(100) NOT NULL,
	`publicoAlvo` varchar(255),
	`grauRisco` enum('remoto','baixo','medio','alto') NOT NULL DEFAULT 'baixo',
	`baseLegal` text,
	`contextoDoireito` text,
	`tributoDoCredito` varchar(100),
	`documentacaoNecessaria` text,
	`informacoesAnalise` text,
	`formaUtilizacao` text,
	`status` enum('ativa','inativa') NOT NULL DEFAULT 'inativa',
	`ativa` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teses_id` PRIMARY KEY(`id`)
);
